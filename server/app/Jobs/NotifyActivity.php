<?php

namespace App\Jobs;

use App\Events\DataChanged;
use App\Models\Activity;
use App\Models\Notice;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class NotifyActivity implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $activityId) {}

    public function handle(): void
    {
        $a = Activity::find($this->activityId);
        if (! $a) {
            return;
        }
        User::where('active', true)->where('village_id', $a->village_id)->when($a->group_id, fn ($q) => $q->where(fn ($q) => $q->where('group_id', $a->group_id)->orWhere(fn ($q) => $q->where('role', 'pengurus')->whereNull('group_id'))))->chunkById(100, function ($users) use ($a) {
            foreach ($users as $u) {
                Notice::create(['user_id' => $u->id, 'title' => 'Pembaruan kegiatan', 'body' => $a->title.' · '.$a->starts_at->format('d/m/Y H:i')]);
                DataChanged::dispatch($a->village_id, $a->group_id, $u->id);
                SendPush::dispatch($u->id, 'Pembaruan kegiatan JiMS', 'Buka JiMS untuk melihat agenda terbaru.');
            }
        });
    }
}
