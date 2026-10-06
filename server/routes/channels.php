<?php

use App\Models\Group;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('village.{id}', fn (User $u, int $id) => $u->active && $u->canSee((object) ['village_id' => $id, 'group_id' => null]));
Broadcast::channel('group.{id}', function (User $u, int $id) {
    $g = Group::find($id);

    return $u->active && $g && $u->canSee((object) ['village_id' => $g->village_id, 'group_id' => $g->id]);
});
Broadcast::channel('user.{id}', fn (User $u, int $id) => $u->active && $u->id === $id);
