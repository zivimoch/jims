<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserDapukan extends Model
{
    protected $guarded = ['id'];

    protected $with = ['type'];

    protected $appends = ['label'];

    public function type()
    {
        return $this->belongsTo(DapukanType::class, 'dapukan_type_id');
    }

    public function getLabelAttribute()
    {
        return $this->type->name.' '.($this->group_id ? 'Kelompok' : ($this->village_id ? 'Desa' : 'Daerah'));
    }
}
