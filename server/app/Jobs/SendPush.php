<?php

namespace App\Jobs;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class SendPush implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $userId, public string $title, public string $body) {}

    public function handle(): void
    {
        if (! config('services.webpush.private_key') || ! User::whereKey($this->userId)->where('active', true)->exists()) {
            return;
        }
        $push = new WebPush(['VAPID' => ['subject' => config('services.webpush.subject'), 'publicKey' => config('services.webpush.public_key'), 'privateKey' => config('services.webpush.private_key')]], [], 20, ['allow_redirects' => false]);
        foreach (PushSubscription::where('user_id', $this->userId)->cursor() as $s) {
            $report = $push->sendOneNotification(Subscription::create(['endpoint' => $s->endpoint, 'publicKey' => $s->public_key, 'authToken' => $s->auth_token, 'contentEncoding' => 'aes128gcm']), json_encode(['title' => $this->title, 'body' => $this->body, 'url' => '/']), ['TTL' => 3600]);
            if ($report->isSubscriptionExpired()) {
                $s->delete();
            } elseif (! $report->isSuccess()) {
                throw new \RuntimeException('Pengiriman push gagal; antrean akan mencoba kembali.');
            }
        }
    }
}
