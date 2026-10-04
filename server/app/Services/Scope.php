<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class Scope
{
    public static function visible(Builder $query, User $u): Builder
    {
        if ($u->isSuper()) {
            return $query;
        }
        $query->where('village_id', $u->village_id);
        if ($u->role !== 'pengurus' || $u->group_id !== null) {
            $query->where(fn ($q) => $q->whereNull('group_id')->orWhere('group_id', $u->group_id));
        }

        return $query;
    }

    public static function managed(Builder $query, User $u): Builder
    {
        if ($u->isSuper()) {
            return $query;
        }
        $query->where('village_id', $u->village_id)->where('role', 'jamaah');
        if ($u->group_id !== null) {
            $query->where('group_id', $u->group_id);
        }

        return $query;
    }
}
