<?php

namespace App\Jobs;

use App\Models\Activity;
use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class NotifyActivity implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $activityId) {}

    public function handle(): void
    {
        DB::transaction(function () {
            $a = Activity::lockForUpdate()->find($this->activityId);
            if (! $a || $a->starts_at->gt(now()->addHours(2)) || $a->starts_at->lte(now()->addHours(2)->subMinute()) || ($a->reminder_sent_for && $a->starts_at->equalTo($a->reminder_sent_for))) {
                return;
            }
            User::where('active', true)->whereIn('id', PushSubscription::select('user_id'))->with('dapukans')->chunkById(100, function ($users) use ($a) {
                foreach ($users as $u) {
                    if ($u->canSee($a)) {
                        SendPush::dispatch($u->id, 'Pengingat pengajian', $a->title.' dimulai 2 jam lagi · '.$a->starts_at->timezone('Asia/Jakarta')->format('H:i').' WIB · '.$a->location)->afterCommit();
                    }
                }
            });
            $a->update(['reminder_sent_for' => $a->starts_at]);
        });
    }
}
