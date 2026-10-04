<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('villages', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->timestamps();
        });
        Schema::create('groups', function (Blueprint $t) {
            $t->id();
            $t->foreignId('village_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->unique(['village_id', 'name']);
            $t->timestamps();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->enum('role', ['super_admin', 'pengurus', 'jamaah'])->default('jamaah');
            $t->foreignId('village_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('group_id')->nullable()->constrained()->restrictOnDelete();
            $t->boolean('active')->default(true);
            $t->index(['village_id', 'group_id', 'role']);
        });
        Schema::create('activities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('village_id')->constrained()->restrictOnDelete();
            $t->foreignId('group_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('title', 150);
            $t->string('location', 200);
            $t->string('class_name', 60);
            $t->timestampTz('starts_at');
            $t->timestampTz('ends_at');
            $t->jsonb('materials');
            $t->text('note')->nullable();
            $t->string('zoom_url', 500)->nullable();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();
            $t->index(['village_id', 'group_id', 'starts_at']);
        });
        Schema::create('attendances', function (Blueprint $t) {
            $t->id();
            $t->foreignId('activity_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $t->enum('status', ['offline', 'online', 'izin']);
            $t->string('reason', 200)->nullable();
            $t->timestamps();
            $t->unique(['activity_id', 'user_id']);
        });
        Schema::create('contributions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('village_id')->constrained()->restrictOnDelete();
            $t->foreignId('group_id')->nullable()->constrained()->restrictOnDelete();
            $t->enum('category', ['Kas', 'Tabungan Jalan-jalan']);
            $t->string('class_name', 60);
            $t->unsignedBigInteger('amount');
            $t->date('date');
            $t->string('note', 200)->nullable();
            $t->timestamps();
        });
        Schema::create('payment_accounts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('village_id')->constrained()->restrictOnDelete();
            $t->foreignId('group_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('bank');
            $t->string('number');
            $t->string('holder');
            $t->boolean('is_dummy')->default(true);
            $t->timestamps();
        });
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->text('endpoint');
            $t->string('endpoint_hash', 64)->unique();
            $t->string('public_key');
            $t->string('auth_token');
            $t->timestamps();
        });
        Schema::create('notices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->text('body');
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'created_at']);
        });
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action');
            $t->string('entity');
            $t->unsignedBigInteger('entity_id');
            $t->jsonb('details')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['audit_logs', 'notices', 'push_subscriptions', 'payment_accounts', 'contributions', 'attendances', 'activities'] as $name) {
            Schema::dropIfExists($name);
        }
        Schema::table('users', function (Blueprint $t) {
            $t->dropConstrainedForeignId('group_id');
            $t->dropConstrainedForeignId('village_id');
            $t->dropColumn(['role', 'active']);
        });
        Schema::dropIfExists('groups');
        Schema::dropIfExists('villages');
    }
};
