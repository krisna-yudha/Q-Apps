<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah field traceability dari roadmap V2:
     * source_ca, source_layanan, hashtag, ever_changed
     * Sesuai roadmap §23 — ca_assessments harus menampung field bisnis yang sama
     * dengan sample QSF, termasuk CA, Layanan, dan Hashtag.
     */
    public function up(): void
    {
        Schema::table('ca_assessments', function (Blueprint $table) {
            // Nilai asli kolom CA dari Excel QSF (traceability)
            if (!Schema::hasColumn('ca_assessments', 'source_ca')) {
                $table->string('source_ca', 150)->nullable()->after('fcr_note');
            }

            // Nilai asli kolom Layanan dari Excel QSF (traceability)
            if (!Schema::hasColumn('ca_assessments', 'source_layanan')) {
                $table->string('source_layanan', 150)->nullable()->after('source_ca');
            }

            // Nilai kolom Hashtag dari Excel QSF
            if (!Schema::hasColumn('ca_assessments', 'hashtag')) {
                $table->string('hashtag', 255)->nullable()->after('source_layanan');
            }

            // Nilai kolom "Pernah Diubah" dari Excel QSF
            if (!Schema::hasColumn('ca_assessments', 'ever_changed')) {
                $table->boolean('ever_changed')->default(false)->after('hashtag');
            }

            // employee_id sebagai referensi ke employees table (roadmap V2 approach)
            if (!Schema::hasColumn('ca_assessments', 'employee_id')) {
                $table->unsignedBigInteger('employee_id')->nullable()->after('agent_id');
                $table->foreign('employee_id')->references('id')->on('employees')->nullOnDelete();
            }

            // qa_user_id sebagai referensi ke users table (roadmap V2 approach)
            if (!Schema::hasColumn('ca_assessments', 'qa_user_id')) {
                $table->unsignedBigInteger('qa_user_id')->nullable()->after('qa_id');
                $table->foreign('qa_user_id')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('ca_assessments', function (Blueprint $table) {
            $table->dropForeign(['employee_id']);
            $table->dropForeign(['qa_user_id']);
            $table->dropColumn([
                'source_ca',
                'source_layanan',
                'hashtag',
                'ever_changed',
                'employee_id',
                'qa_user_id',
            ]);
        });
    }
};
