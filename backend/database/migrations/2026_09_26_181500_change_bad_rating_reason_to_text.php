<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sampling_assignments', function (Blueprint $table) {
            if (Schema::hasColumn('sampling_assignments', 'bad_rating_reason')) {
                $table->text('bad_rating_reason')->nullable()->change();
            }
        });

        Schema::table('ca_assessments', function (Blueprint $table) {
            if (Schema::hasColumn('ca_assessments', 'bad_rating_reason')) {
                $table->text('bad_rating_reason')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('sampling_assignments', function (Blueprint $table) {
            if (Schema::hasColumn('sampling_assignments', 'bad_rating_reason')) {
                $table->string('bad_rating_reason', 255)->nullable()->change();
            }
        });

        Schema::table('ca_assessments', function (Blueprint $table) {
            if (Schema::hasColumn('ca_assessments', 'bad_rating_reason')) {
                $table->string('bad_rating_reason', 255)->nullable()->change();
            }
        });
    }
};
