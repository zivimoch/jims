<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['materials' => 'array', 'starts_at' => 'immutable_datetime', 'ends_at' => 'immutable_datetime'];
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function village()
    {
        return $this->belongsTo(Village::class);
    }
}
