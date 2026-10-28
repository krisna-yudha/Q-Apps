<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Table Real Monitoring (QA On-Duty Direct Observation & Ticket Elimination Engine)
        if (!Schema::hasTable('real_monitorings')) {
            Schema::create('real_monitorings', function (Blueprint $table) {
                $table->id();
                $table->string('no_icrm', 100)->index(); // Wajib
                $table->string('no_transaksi', 100)->nullable()->index(); // Acuan Kunci Eliminasi
                $table->string('no_omni', 100)->nullable()->index(); // Opsional / Terkait
                $table->string('no_ichat', 100)->nullable()->index(); // Opsional / Terkait
                $table->string('nama_agent', 150)->index(); // Wajib
                $table->foreignId('agent_id')->nullable()->constrained('agents')->nullOnDelete();
                $table->string('layanan', 50)->index(); // Wajib: Inbound, Digilive, Socmed, Email, Email Outbound, OBC, BO
                $table->foreignId('qa_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('qa_name', 150)->nullable()->index();
                $table->date('monitoring_date')->index();
                $table->time('monitoring_time')->nullable();
                $table->text('notes')->nullable(); // Temuan / Catatan Observasi Langsung QA
                $table->string('status', 50)->default('RECORDED'); // RECORDED, AUDITED, ELIMINATED
                $table->boolean('is_eliminated')->default(false);
                $table->timestamp('eliminated_at')->nullable();
                $table->timestamps();
            });
        }

        // 2. Table Bad Rating Registry (Omni & iChat Bad Rating Repository & SPV Monitor)
        if (!Schema::hasTable('bad_rating_tickets')) {
            Schema::create('bad_rating_tickets', function (Blueprint $table) {
                $table->id();
                $table->string('ticket_id', 100)->index();
                $table->string('no_transaksi', 100)->nullable()->index();
                $table->string('source_channel', 50)->index(); // Omni, iChat, Global
                $table->string('customer_name', 150)->nullable();
                $table->string('customer_phone', 50)->nullable();
                $table->string('agent_name', 150)->nullable()->index();
                $table->tinyInteger('csat_rating')->nullable();
                $table->text('bad_rating_reason')->nullable();
                $table->datetime('transaction_date')->nullable();
                $table->foreignId('sampling_assignment_id')->nullable()->constrained('sampling_assignments')->nullOnDelete();
                $table->boolean('is_matched_sampling')->default(false)->index();
                $table->string('matched_qa_name', 150)->nullable()->index();
                $table->string('file_name', 255)->nullable();
                $table->string('period_month', 20)->nullable()->index();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bad_rating_tickets');
        Schema::dropIfExists('real_monitorings');
    }
};
