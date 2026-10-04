<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class DataChanged implements ShouldBroadcast
{
    use Dispatchable;

    public function __construct(private int $village, private ?int $group = null, private ?int $userId = null) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel($this->userId ? 'user.'.$this->userId : ($this->group ? 'group.'.$this->group : 'village.'.$this->village))];
    }

    public function broadcastAs(): string
    {
        return 'data.changed';
    }

    public function broadcastWith(): array
    {
        return ['refresh' => true];
    }
}
