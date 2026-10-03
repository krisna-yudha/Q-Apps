<?php

namespace App\Services;

use App\Models\BackupSetting;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;
use RuntimeException;
use Throwable;

class GoogleDriveConfigService
{
    /**
     * Runtime disk name for Google Drive.
     */
    public const DISK_NAME = 'google_dynamic';

    /**
     * Retrieve the active backup setting.
     */
    public function getActiveSetting(): ?BackupSetting
    {
        return BackupSetting::where('is_active', true)->latest()->first();
    }

    /**
     * Build standard Guzzle HTTP Client with local SSL CA cert bundle.
     */
    public function buildHttpClient(): \GuzzleHttp\Client
    {
        $caPath = storage_path('app/cacert.pem');
        if (file_exists($caPath)) {
            @ini_set('curl.cainfo', $caPath);
            @ini_set('openssl.cafile', $caPath);
        }

        return new \GuzzleHttp\Client([
            'verify'          => file_exists($caPath) ? $caPath : true,
            'timeout'         => 60,
            'connect_timeout' => 30,
        ]);
    }

    /**
     * Build Google Client & Drive service for OAuth2 Personal Account.
     */
    public function buildOAuth2Client(string $clientId, string $clientSecret, string $refreshToken): array
    {
        $clientId = trim($clientId);
        $clientSecret = trim($clientSecret);
        $refreshToken = trim($refreshToken);

        $httpClient = $this->buildHttpClient();

        $client = new Client();
        $client->setHttpClient($httpClient);
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setAccessType('offline');
        $client->setScopes([Drive::DRIVE]);

        $token = $client->fetchAccessTokenWithRefreshToken($refreshToken);
        if (!empty($token['error'])) {
            $errorDesc = $token['error_description'] ?? ($token['error'] ?? 'Gagal memperbarui token OAuth2.');
            throw new RuntimeException("Autentikasi OAuth2 Personal gagal ({$errorDesc}). Pastikan Client ID, Client Secret, dan Refresh Token valid.");
        }

        $driveService = new Drive($client);

        $userEmail = null;
        $userName = null;
        $quotaInfo = null;

        try {
            $about = $driveService->about->get([
                'fields' => 'user(displayName, emailAddress), storageQuota(limit, usage, usageInDrive)',
            ]);
            $userEmail = $about->user?->emailAddress;
            $userName = $about->user?->displayName;
            if ($about->storageQuota) {
                $limit = (int) $about->storageQuota->limit;
                $usage = (int) $about->storageQuota->usage;
                $quotaInfo = [
                    'limit_bytes' => $limit,
                    'usage_bytes' => $usage,
                    'limit_gb'    => $limit > 0 ? round($limit / 1073741824, 2) : 15,
                    'usage_gb'    => round($usage / 1073741824, 2),
                    'free_gb'     => $limit > 0 ? max(0, round(($limit - $usage) / 1073741824, 2)) : null,
                ];
            }
        } catch (Throwable $e) {
            // Non-fatal if about query fails
            Log::warning('[GoogleDriveConfigService] Failed to fetch about info: ' . $e->getMessage());
        }

        return [
            'client'        => $client,
            'drive_service' => $driveService,
            'user_email'    => $userEmail,
            'user_name'     => $userName,
            'quota'         => $quotaInfo,
            'token'         => $token,
        ];
    }

    /**
     * Build Google Client & Drive service for Service Account.
     */
    public function buildServiceAccountClient(array $credentials): array
    {
        $httpClient = $this->buildHttpClient();
        $httpHandler = \Google\Auth\HttpHandler\HttpHandlerFactory::build($httpClient);

        $saCredentials = new \Google\Auth\Credentials\ServiceAccountCredentials(
            Drive::DRIVE,
            $credentials
        );

        $token = $saCredentials->fetchAuthToken($httpHandler);
        if (empty($token['access_token'])) {
            $errorDesc = $token['error_description'] ?? ($token['error'] ?? 'Gagal mendapatkan access token.');
            throw new RuntimeException("Autentikasi Service Account gagal: {$errorDesc}");
        }

        $client = new Client();
        $client->setHttpClient($httpClient);
        $client->setAccessToken($token);
        $client->setScopes([Drive::DRIVE]);

        $driveService = new Drive($client);

        return [
            'client'        => $client,
            'drive_service' => $driveService,
            'client_email'  => $credentials['client_email'] ?? null,
            'project_id'    => $credentials['project_id'] ?? null,
            'token'         => $token,
        ];
    }

    /**
     * Register dynamic Google Drive disk and configure Spatie Backup destination disk.
     *
    /**
     * Clean and extract raw Google Drive Folder ID from full URLs or query strings.
     */
    public static function cleanFolderId(?string $input): string
    {
        if (empty($input)) return '';
        $clean = trim((string) $input);
        if (preg_match('#/folders/([a-zA-Z0-9_-]+)#', $clean, $matches)) {
            return $matches[1];
        }
        if (str_contains($clean, '?')) {
            $clean = explode('?', $clean)[0];
        }
        $clean = preg_replace('#[^a-zA-Z0-9_-]#', '', $clean);
        return trim((string) $clean);
    }

    /**
     * Register dynamic storage disk 'google_dynamic' based on active settings.
     *
     * @return array
     * @throws RuntimeException
     */
    public function registerDisk(?BackupSetting $setting = null): array
    {
        $setting = $setting ?: $this->getActiveSetting();

        if (!$setting) {
            throw new RuntimeException('Pengaturan Google Drive belum dikonfigurasi atau dalam status tidak aktif.');
        }

        $folderId = self::cleanFolderId($setting->google_drive_folder_id);
        if (empty($folderId)) {
            throw new RuntimeException('Target Google Drive Folder ID belum ditentukan.');
        }

        if (str_contains($folderId, '@') || str_ends_with($folderId, '.iam.gserviceaccount.com')) {
            throw new RuntimeException("Target Google Drive Folder ID tidak valid ({$folderId}). Anda memasukkan alamat email. Masukkan ID folder Google Drive tempat menyimpan backup.");
        }

        $authType = $setting->auth_type ?: 'service_account';

        try {
            $accountEmail = null;

            if ($authType === 'oauth2') {
                if (empty($setting->oauth_client_id) || empty($setting->oauth_client_secret) || empty($setting->oauth_refresh_token)) {
                    throw new RuntimeException('Kredensial OAuth2 (Client ID, Client Secret, dan Refresh Token) belum lengkap.');
                }

                $oauthResult = $this->buildOAuth2Client(
                    $setting->oauth_client_id,
                    $setting->oauth_client_secret,
                    $setting->oauth_refresh_token
                );

                $driveService = $oauthResult['drive_service'];
                $accountEmail = $oauthResult['user_email'] ?: $setting->oauth_user_email;

                // Sync user email in database if retrieved
                if ($oauthResult['user_email'] && $setting->oauth_user_email !== $oauthResult['user_email']) {
                    $setting->update(['oauth_user_email' => $oauthResult['user_email']]);
                }
            } else {
                // Service Account Mode
                if (empty($setting->service_account_json)) {
                    throw new RuntimeException('Kredensial Service Account JSON kosong.');
                }

                $rawCredentials = $setting->service_account_json;
                $credentials = is_array($rawCredentials)
                    ? $rawCredentials
                    : json_decode((string) $rawCredentials, true);

                if (!is_array($credentials) || empty($credentials['client_email']) || empty($credentials['private_key'])) {
                    throw new RuntimeException('Format Service Account JSON tidak valid (harus memiliki field "client_email" dan "private_key").');
                }

                $saResult = $this->buildServiceAccountClient($credentials);
                $driveService = $saResult['drive_service'];
                $accountEmail = $saResult['client_email'];
            }

            // Create Masbug Flysystem Google Drive Adapter with target sharedFolderId
            $adapter = new GoogleDriveAdapter($driveService, null, [
                'sharedFolderId' => $folderId,
                'parameters'     => [
                    'supportsAllDrives' => true,
                ],
            ]);

            $filesystem = new Filesystem($adapter);

            // Register dynamic storage disk to Laravel Storage Manager
            $filesystemAdapter = new FilesystemAdapter($filesystem, $adapter);
            Storage::set(self::DISK_NAME, $filesystemAdapter);

            // Inject runtime configuration to filesystems config
            Config::set('filesystems.disks.' . self::DISK_NAME, [
                'driver'    => 'google',
                'folder_id' => $folderId,
                'email'     => $accountEmail,
                'auth_type' => $authType,
            ]);

            // Override target destination disk Spatie Backup
            Config::set('backup.backup.destination.disks', [self::DISK_NAME]);

            Log::info('[GoogleDriveConfigService] Runtime disk ' . self::DISK_NAME . " ({$authType}) successfully registered.");

            return [
                'disk'         => self::DISK_NAME,
                'folder_id'    => $folderId,
                'account_email'=> $accountEmail,
                'auth_type'    => $authType,
            ];
        } catch (Throwable $e) {
            Log::error('[GoogleDriveConfigService] Failed to register disk: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            throw new RuntimeException('Gagal menginisialisasi Google Drive Client: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Test Google Drive connection by creating, reading, and deleting a probe file with full API diagnostics.
     *
     * @return array
     * @throws RuntimeException
     */
    public function testConnection(?BackupSetting $setting = null): array
    {
        $diskInfo = $this->registerDisk($setting);
        $setting = $setting ?: $this->getActiveSetting();

        $folderId = $diskInfo['folder_id'];
        $authType = $diskInfo['auth_type'];
        $accountEmail = $diskInfo['account_email'];

        $testFileName = 'test_connection_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.txt';
        $testContent = 'DigiQA Google Drive Integration Test Probe - ' . now()->toIso8601String() . ' - Auth: ' . strtoupper($authType);

        try {
            $quotaData = null;

            if ($authType === 'oauth2') {
                $oauthResult = $this->buildOAuth2Client(
                    $setting->oauth_client_id,
                    $setting->oauth_client_secret,
                    $setting->oauth_refresh_token
                );
                $driveService = $oauthResult['drive_service'];
                $accountEmail = $oauthResult['user_email'] ?: $accountEmail;
                $quotaData = $oauthResult['quota'];
            } else {
                $rawCredentials = $setting->service_account_json;
                $credentials = is_array($rawCredentials) ? $rawCredentials : json_decode((string) $rawCredentials, true);
                $saResult = $this->buildServiceAccountClient($credentials);
                $driveService = $saResult['drive_service'];
            }

            // Step 1: Verify folder exists & permissions
            try {
                $folder = $driveService->files->get($folderId, [
                    'fields'            => 'id, name, mimeType, capabilities(canAddChildren, canEdit), trashed',
                    'supportsAllDrives' => true,
                ]);

                if ($folder->getTrashed()) {
                    throw new RuntimeException("Folder Google Drive '{$folder->getName()}' berada di dalam Sampah (Trash). Silakan pulihkan folder.");
                }

                if ($folder->capabilities && !$folder->capabilities->canAddChildren && !$folder->capabilities->canEdit) {
                    throw new RuntimeException("Akun ({$accountEmail}) tidak memiliki hak akses Editor pada folder '{$folder->getName()}'.");
                }
            } catch (\Google\Service\Exception $e) {
                if ($e->getCode() === 404) {
                    throw new RuntimeException("Folder Google Drive tidak ditemukan (404 Not Found). Pastikan ID folder '{$folderId}' benar dan dapat diakses oleh akun {$accountEmail}.");
                }
                throw $e;
            }

            // Step 2: Upload probe test file
            $fileMetadata = new \Google\Service\Drive\DriveFile([
                'name'    => $testFileName,
                'parents' => [$folderId],
            ]);

            $createdFile = $driveService->files->create($fileMetadata, [
                'data'              => $testContent,
                'mimeType'          => 'text/plain',
                'uploadType'        => 'multipart',
                'fields'            => 'id, name',
                'supportsAllDrives' => true,
            ]);

            if (!$createdFile || !$createdFile->getId()) {
                throw new RuntimeException('Gagal membuat berkas uji di Google Drive.');
            }

            // Step 3: Delete probe test file
            $driveService->files->delete($createdFile->getId(), [
                'supportsAllDrives' => true,
            ]);

            $quotaText = '';
            if ($quotaData && isset($quotaData['usage_gb'], $quotaData['limit_gb'])) {
                $quotaText = " [Kapasitas: {$quotaData['usage_gb']} GB / {$quotaData['limit_gb']} GB terpakai]";
            }

            return [
                'success'       => true,
                'message'       => "Koneksi Google Drive ({$authType}) & izin tulis berhasil terverifikasi! Akun: {$accountEmail}{$quotaText}",
                'account_email' => $accountEmail,
                'auth_type'     => $authType,
                'quota'         => $quotaData,
                'folder_name'   => $folder->getName(),
                'tested_at'     => now()->toIso8601String(),
            ];
        } catch (\Google\Service\Exception $e) {
            $errData = @json_decode($e->getMessage(), true);
            $reason = $errData['error']['errors'][0]['reason'] ?? '';
            $apiMsg = $errData['error']['message'] ?? $e->getMessage();

            if ($reason === 'storageQuotaExceeded' || str_contains($apiMsg, 'storage quota') || str_contains($apiMsg, 'Service Accounts do not have storage quota')) {
                $friendlyMsg = "Google Drive Kuota Error (403 storageQuotaExceeded): Akun Google Service Account tidak memiliki kuota penyimpanan pada 'Drive Saya' pribadi. Gunakan metode koneksi 'OAuth2 Personal Drive' (Client ID, Secret & Refresh Token) untuk langsung memakai kuota 15 GB akun Gmail pribadi Anda, atau gunakan Shared Drive.";
            } elseif ($e->getCode() === 403) {
                $friendlyMsg = "Akses Ditolak (403 Forbidden): {$apiMsg}. Pastikan folder telah di-share ke {$accountEmail} dengan hak akses Editor.";
            } elseif ($e->getCode() === 404) {
                $friendlyMsg = "Folder Tidak Ditemukan (404 Not Found): {$apiMsg}.";
            } else {
                $friendlyMsg = "Google Drive API Error ({$e->getCode()}): {$apiMsg}";
            }

            Log::error('Google Drive Test Connection Error: ' . $friendlyMsg, [
                'raw_error' => $e->getMessage(),
                'trace'     => $e->getTraceAsString()
            ]);

            throw new RuntimeException($friendlyMsg, $e->getCode(), $e);
        } catch (Throwable $e) {
            $detailedMessage = $e->getMessage();
            if ($e->getPrevious() && !str_contains($detailedMessage, $e->getPrevious()->getMessage())) {
                $detailedMessage .= ' (' . $e->getPrevious()->getMessage() . ')';
            }

            Log::error('Google Drive Test Connection Error: ' . $detailedMessage, [
                'trace' => $e->getTraceAsString()
            ]);

            throw new RuntimeException($detailedMessage, 0, $e);
        }
    }

    /**
     * Generate Google OAuth authorization URL.
     */
    public function generateOAuthUrl(string $clientId, string $clientSecret, string $redirectUri): string
    {
        $httpClient = $this->buildHttpClient();

        $client = new Client();
        $client->setHttpClient($httpClient);
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($redirectUri);
        $client->setAccessType('offline');
        $client->setPrompt('consent');
        $client->setScopes([Drive::DRIVE]);

        return $client->createAuthUrl();
    }

    /**
     * Exchange OAuth2 Authorization Code for Refresh Token & User Info.
     */
    public function exchangeOAuthCode(string $clientId, string $clientSecret, string $code, string $redirectUri): array
    {
        $httpClient = $this->buildHttpClient();

        $client = new Client();
        $client->setHttpClient($httpClient);
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($redirectUri);
        $client->setAccessType('offline');
        $client->setScopes([Drive::DRIVE]);

        $token = $client->fetchAccessTokenWithAuthCode($code);
        if (!empty($token['error'])) {
            $desc = $token['error_description'] ?? ($token['error'] ?? 'Gagal menukarkan Authorization Code.');
            throw new RuntimeException("Pertukaran Authorization Code gagal: {$desc}");
        }

        $refreshToken = $token['refresh_token'] ?? null;
        if (empty($refreshToken)) {
            throw new RuntimeException('Google tidak mengembalikan Refresh Token. Pastikan Anda menyetujui akses dan prompt consent diizinkan.');
        }

        $driveService = new Drive($client);
        $userEmail = null;
        try {
            $about = $driveService->about->get(['fields' => 'user(displayName, emailAddress)']);
            $userEmail = $about->user?->emailAddress;
        } catch (Throwable) {
            // Ignored
        }

        return [
            'refresh_token' => $refreshToken,
            'user_email'    => $userEmail,
            'access_token'  => $token['access_token'] ?? null,
            'expires_in'    => $token['expires_in'] ?? 3600,
        ];
    }
}
