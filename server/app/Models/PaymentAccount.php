<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentAccount extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['is_dummy' => 'boolean'];
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }
}
