<?php

use App\Models\Group;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('village.{id}', fn (User $u, int $id) => $u->active && ($u->isSuper() || $u->village_id === $id));
Broadcast::channel('group.{id}', function (User $u, int $id) {
    $g = Group::find($id);

    return $u->active && $g && ($u->isSuper() || ($u->village_id === $g->village_id && ($u->group_id === $g->id || ($u->role === 'pengurus' && $u->group_id === null))));
});
Broadcast::channel('user.{id}', fn (User $u, int $id) => $u->active && $u->id === $id);
