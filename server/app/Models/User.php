<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = ['name', 'phone', 'email', 'password', 'role', 'village_id', 'group_id', 'active'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'active' => 'boolean', 'email_verified_at' => 'datetime'];
    }

    public function village()
    {
        return $this->belongsTo(Village::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function isSuper(): bool
    {
        return $this->role === 'super_admin';
    }

    public function manages($record): bool
    {
        if ($this->isSuper()) {
            return true;
        }

        return $this->role === 'pengurus' && $this->village_id === $record->village_id && ($this->group_id === null || $this->group_id === $record->group_id);
    }

    public function canSee($record): bool
    {
        return $this->isSuper() || ($this->village_id === $record->village_id && ($record->group_id === null || $this->group_id === $record->group_id || ($this->role === 'pengurus' && $this->group_id === null)));
    }
}
