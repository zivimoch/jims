<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 13)->nullable()->unique();
            $table->string('email')->nullable()->change();
        });
        // Assign synthetic phone numbers only to the explicitly seeded demo accounts.
        $counter = 0;
        foreach (DB::table('users')->where('email', 'like', '%@jims.test')->orderBy('id')->get() as $user) {
            DB::table('users')->where('id', $user->id)->update(['phone' => '0800'.str_pad((string) ++$counter, 8, '0', STR_PAD_LEFT)]);
        }
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('phone'));
    }
};
