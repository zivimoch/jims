<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        Schema::create('regions', function (Blueprint $t) {
            $t->id();
            $t->string('name', 100)->unique();
            $t->timestamps();
        });
        Schema::table('villages', function (Blueprint $t) {
            $t->foreignId('region_id')->nullable()->constrained()->restrictOnDelete();
            $t->unique(['region_id', 'name']);
        });
        Schema::table('users', function (Blueprint $t) {
            $t->foreignId('region_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('address', 500)->nullable();
        });
        Schema::create('dapukan_types', function (Blueprint $t) {
            $t->id();
            $t->string('name', 100)->unique();
            $t->timestamps();
        });
        Schema::create('user_dapukans', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('dapukan_type_id')->constrained()->restrictOnDelete();
            $t->foreignId('region_id')->constrained()->restrictOnDelete();
            $t->foreignId('village_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('group_id')->nullable()->constrained()->restrictOnDelete();
            $t->timestamps();
            $t->index(['region_id', 'village_id', 'group_id']);
        });
        DB::statement('CREATE UNIQUE INDEX user_dapukan_unique ON user_dapukans (user_id, dapukan_type_id, region_id, village_id, group_id) NULLS NOT DISTINCT');
        Schema::create('master_options', function (Blueprint $t) {
            $t->id();
            $t->string('kind', 20);
            $t->string('name', 200);
            $t->foreignId('village_id')->constrained()->restrictOnDelete();
            $t->foreignId('group_id')->nullable()->constrained()->restrictOnDelete();
            $t->timestamps();
        });
        DB::statement('CREATE UNIQUE INDEX master_option_unique ON master_options (kind, lower(name), village_id, group_id) NULLS NOT DISTINCT');
        Schema::create('activity_class', function (Blueprint $t) {
            $t->foreignId('activity_id')->constrained()->cascadeOnDelete();
            $t->foreignId('master_option_id')->constrained()->restrictOnDelete();
            $t->primary(['activity_id', 'master_option_id']);
        });
        Schema::table('activities', fn (Blueprint $t) => $t->boolean('attendance_enabled')->default(true));
        Schema::create('brand_settings', function (Blueprint $t) {
            $t->id();
            $t->string('name', 100);
            $t->string('subtitle', 200)->nullable();
            $t->foreignId('default_village_id')->nullable()->constrained('villages')->nullOnDelete();
            $t->timestamps();
        });
        $now = now();
        $region = DB::table('regions')->insertGetId(['name' => 'Daerah Contoh', 'created_at' => $now, 'updated_at' => $now]);
        DB::table('villages')->update(['region_id' => $region]);
        DB::table('users')->whereNotNull('village_id')->update(['region_id' => $region]);
        // Rename only the bundled demo village; preserve other village names.
        DB::table('villages')->where('name', 'Jati Perhubungan')->update(['name' => 'Desa 9']);
        foreach (['Kiyai', 'Mubalegh', 'Kepala Sekolah Karakter', 'Keuangan'] as $name) {
            DB::table('dapukan_types')->insert(['name' => $name, 'created_at' => $now, 'updated_at' => $now]);
        }
        $type = DB::table('dapukan_types')->where('name', 'Kiyai')->value('id');
        foreach (DB::table('users')->where('role', 'pengurus')->whereNotNull('village_id')->get() as $u) {
            DB::table('user_dapukans')->insert(['user_id' => $u->id, 'dapukan_type_id' => $type, 'region_id' => $region, 'village_id' => $u->village_id, 'group_id' => $u->group_id, 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach (DB::table('villages')->get() as $v) {
            foreach (['Umum', 'Bapak-bapak', 'Ibu-ibu', 'Keputrian', 'Remaja', 'Pra Remaja', 'Caberawit', 'Paud'] as $name) {
                DB::table('master_options')->insert(['kind' => 'class', 'name' => $name, 'village_id' => $v->id, 'created_at' => $now, 'updated_at' => $now]);
            }
        }
        foreach (DB::table('activities')->get() as $a) {
            foreach (['class' => $a->class_name, 'place' => $a->location, 'title' => $a->title] as $kind => $name) {
                $id = DB::table('master_options')->where(compact('kind', 'name'))->where('village_id', $a->village_id)->whereNull('group_id')->value('id');
                $id ??= DB::table('master_options')->insertGetId(['kind' => $kind, 'name' => $name, 'village_id' => $a->village_id, 'created_at' => $now, 'updated_at' => $now]);
                if ($kind === 'class') {
                    DB::table('activity_class')->insert(['activity_id' => $a->id, 'master_option_id' => $id]);
                }
            }
        }
        DB::table('brand_settings')->insert(['name' => 'JiMS', 'subtitle' => 'Sistem jamaah daerah, desa, dan kelompok', 'default_village_id' => DB::table('villages')->where('name', 'Desa 9')->value('id'), 'created_at' => $now, 'updated_at' => $now]);
        foreach (['regions', 'villages', 'groups', 'dapukan_types', 'master_options', 'users'] as $table) {
            DB::statement("CREATE INDEX {$table}_name_trgm ON {$table} USING gin (name gin_trgm_ops)");
        }
    }

    public function down(): void
    {
        foreach (['regions', 'villages', 'groups', 'dapukan_types', 'master_options', 'users'] as $table) {
            DB::statement("DROP INDEX IF EXISTS {$table}_name_trgm");
        }
        Schema::dropIfExists('brand_settings');
        Schema::dropIfExists('activity_class');
        Schema::dropIfExists('master_options');
        Schema::dropIfExists('user_dapukans');
        Schema::dropIfExists('dapukan_types');
        Schema::table('activities', fn (Blueprint $t) => $t->dropColumn('attendance_enabled'));
        Schema::table('users', function (Blueprint $t) {
            $t->dropConstrainedForeignId('region_id');
            $t->dropColumn('address');
        });
        Schema::table('villages', function (Blueprint $t) {
            $t->dropUnique(['region_id', 'name']);
            $t->dropConstrainedForeignId('region_id');
        });
        Schema::dropIfExists('regions');
    }
};
