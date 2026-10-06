<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = ['name', 'phone', 'email', 'password', 'role', 'village_id', 'group_id', 'active', 'region_id', 'address'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'active' => 'boolean', 'email_verified_at' => 'datetime'];
    }

    public function region()
    {
        return $this->belongsTo(Region::class);
    }

    public function dapukans()
    {
        return $this->hasMany(UserDapukan::class);
    }

    public function managementScopes(): array
    {
        if ($this->role !== 'pengurus') {
            return [];
        }
        $scopes = $this->dapukans->map(fn ($d) => $d->only(['region_id', 'village_id', 'group_id']))->all();

        // Compatibility for legacy/imported accounts; new pengurus require assignments.
        return $scopes ?: ($this->village_id ? [['region_id' => $this->region_id, 'village_id' => $this->village_id, 'group_id' => $this->group_id]] : []);
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
        $region = $record->region_id ?? ($record->village_id ? Village::find($record->village_id)?->region_id : null);
        foreach ($this->managementScopes() as $scope) {
            if ($scope['group_id']) {
                if ($scope['group_id'] === $record->group_id && $scope['village_id'] === $record->village_id) {
                    return true;
                }
            } elseif ($scope['village_id']) {
                if ($scope['village_id'] === $record->village_id) {
                    return true;
                }
            } elseif ($scope['region_id'] && $scope['region_id'] === $region) {
                return true;
            }
        }

        return false;
    }

    public function canSee($record): bool
    {
        if ($record->group_id === null && collect($this->managementScopes())->contains(fn ($s) => $s['village_id'] === $record->village_id && $s['village_id'] !== null)) {
            return true;
        }

        return $this->manages($record) || ($this->village_id !== null && $this->village_id === $record->village_id && ($record->group_id === null || $this->group_id === $record->group_id));
    }
}
