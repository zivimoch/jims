<?php

namespace App\Services;

use App\Models\User;
use App\Models\Village;
use Illuminate\Database\Eloquent\Builder;

class Scope
{
    public static function visible(Builder $query, User $u): Builder
    {
        if ($u->isSuper()) {
            return $query;
        }

        return $query->where(function ($q) use ($u) {
            $q->whereRaw('1=0');
            if ($u->village_id) {
                $q->orWhere(fn ($q) => $q->where('village_id', $u->village_id)->where(fn ($q) => $q->whereNull('group_id')->orWhere('group_id', $u->group_id)));
            }
            foreach ($u->managementScopes() as $s) {
                if ($s['village_id']) {
                    $q->orWhere(fn ($q) => $q->where('village_id', $s['village_id'])->whereNull('group_id'));
                }
            }
            self::addManagement($q, $u);
        });
    }

    public static function management(Builder $query, User $u): Builder
    {
        if ($u->isSuper()) {
            return $query;
        }

        return $query->where(function ($q) use ($u) {
            $q->whereRaw('1=0');
            self::addManagement($q, $u);
        });
    }

    private static function addManagement(Builder $q, User $u): void
    {
        foreach ($u->managementScopes() as $s) {
            $q->orWhere(function ($q) use ($s) {
                if ($s['village_id']) {
                    $q->where('village_id', $s['village_id']);
                } else {
                    $q->whereIn('village_id', Village::where('region_id', $s['region_id'])->select('id'));
                }
                if ($s['group_id']) {
                    $q->where('group_id', $s['group_id']);
                }
            });
        }
    }

    public static function managed(Builder $query, User $u): Builder
    {
        return self::management($query, $u)->where('role', 'jamaah');
    }
}
