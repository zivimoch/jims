<?php

use App\Jobs\NotifyActivity;
use App\Models\Activity;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Minishlink\WebPush\VAPID;

Artisan::command('jims:vapid', function () {
    $path = storage_path('app/vapid.json');
    if (! file_exists($path)) {
        file_put_contents($path, json_encode(VAPID::createVapidKeys()));
        chmod($path, 0600);
    }
    $this->info('Kunci push siap di volume privat aplikasi.');
});
Artisan::command('jims:demo-today', function () {
    if (app()->environment('production')) {
        $this->error('Hanya untuk data contoh lokal.');

        return 1;
    }
    foreach (Activity::where('note', 'Kegiatan contoh untuk mencoba JiMS.')->get() as $activity) {
        $activity->update(['starts_at' => now()->startOfDay()->addHours($activity->group_id ? 5 : 20), 'ends_at' => $activity->group_id ? now()->startOfDay()->addHours(22) : now()->setTime(21, 30)]);
    }
    $this->info('Tanggal kegiatan contoh disesuaikan ke hari ini; kegiatan lain tidak diubah.');
});

Artisan::command('jims:remind', function () {
    Activity::where('starts_at', '>', now()->addHours(2)->subMinute())
        ->where('starts_at', '<=', now()->addHours(2))
        ->where(fn ($q) => $q->whereNull('reminder_sent_for')->orWhereColumn('reminder_sent_for', '!=', 'starts_at'))
        ->eachById(fn ($activity) => (new NotifyActivity($activity->id))->handle());
});
Schedule::command('jims:remind')->everyMinute()->withoutOverlapping();
