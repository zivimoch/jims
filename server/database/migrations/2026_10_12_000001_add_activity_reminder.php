<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activities', fn (Blueprint $t) => $t->timestampTz('reminder_sent_for')->nullable());
    }

    public function down(): void
    {
        Schema::table('activities', fn (Blueprint $t) => $t->dropColumn('reminder_sent_for'));
    }
};
