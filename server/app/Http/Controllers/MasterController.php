<?php

namespace App\Http\Controllers;

use App\Models\BrandSetting;
use App\Models\DapukanType;
use App\Models\Group;
use App\Models\MasterOption;
use App\Models\Region;
use App\Models\Village;
use App\Services\Scope;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MasterController extends Controller
{
    private function model(string $kind): string
    {
        return match ($kind) {
            'region' => Region::class, 'village' => Village::class, 'group' => Group::class, 'dapukan' => DapukanType::class, 'class','place','title' => MasterOption::class, default => abort(404)
        };
    }

    public function index(Request $r, string $kind)
    {
        $r->validate(['q' => 'nullable|string|max:200', 'village_id' => 'nullable|integer', 'region_id' => 'nullable|integer', 'group_id' => 'nullable|integer']);
        $model = $this->model($kind);
        $q = $model::query();
        $u = $r->user();
        if ($model === MasterOption::class) {
            $q->where('kind', $kind);
            Scope::visible($q, $u);
        } elseif (! $u->isSuper() && $kind !== 'dapukan') {
            $villages = Village::all()->filter(fn ($v) => $u->canSee((object) ['village_id' => $v->id, 'group_id' => null, 'region_id' => $v->region_id]));
            if ($kind === 'region') {
                $q->whereIn('id', $villages->pluck('region_id'));
            } elseif ($kind === 'village') {
                $q->whereIn('id', $villages->pluck('id'));
            } else {
                $q->whereIn('id', Group::all()->filter(fn ($g) => $u->canSee((object) ['village_id' => $g->village_id, 'group_id' => $g->id]))->pluck('id'));
            }
        }
        if ($r->filled('region_id') && $kind === 'village') {
            $q->where('region_id', $r->integer('region_id'));
        }
        if ($r->filled('village_id') && ($kind === 'group' || $model === MasterOption::class)) {
            $q->where('village_id', $r->integer('village_id'));
        }
        if ($model === MasterOption::class && $r->has('group_id')) {
            $q->where(fn ($q) => $q->whereNull('group_id')->orWhere('group_id', $r->input('group_id') ?: null));
        }
        if ($r->filled('q')) {
            $term = trim($r->input('q'));
            $q->where(fn ($q) => $q->where('name', 'ilike', '%'.$term.'%')->orWhereRaw('name % ?', [$term]))
                ->orderByRaw('CASE WHEN lower(name)=lower(?) THEN 0 WHEN name ILIKE ? THEN 1 ELSE 2 END', [$term, $term.'%'])->orderByRaw('similarity(name, ?) DESC', [$term]);
        }

        return $q->orderBy('name')->limit(50)->get();
    }

    public function save(Request $r, string $kind, ?int $id = null)
    {
        $model = $this->model($kind);
        $u = $r->user();
        $record = $id ? $model::findOrFail($id) : new $model;
        if ($model === MasterOption::class) {
            abort_if($u->role === 'jamaah', 403);
            if ($id) {
                abort_unless($record->kind === $kind && $u->manages($record), 403);
            }
        } else {
            abort_unless($u->isSuper(), 403);
        }
        $r->merge(['name' => is_string($r->name) ? preg_replace('/\s+/u', ' ', trim($r->name)) : $r->name]);
        $data = $r->validate(['name' => 'required|string|max:'.($kind === 'class' ? 60 : 100)]);
        if ($model === MasterOption::class || $kind === 'group') {
            $scope = $r->validate(['village_id' => 'required|integer|exists:villages,id', 'group_id' => ['nullable', 'integer', Rule::exists('groups', 'id')->where('village_id', $r->input('village_id'))]]);
            if ($kind === 'group') {
                unset($scope['group_id']);
            } else {
                $scope['group_id'] ??= null;
                abort_unless($u->manages((object) $scope), 403);
                $data['kind'] = $kind;
            }
            $data = [...$data, ...$scope];
        }
        if ($kind === 'village') {
            $data += $r->validate(['region_id' => 'required|integer|exists:regions,id']);
        }
        if ($id) {
            foreach (['region_id', 'village_id', 'group_id'] as $key) {
                if (array_key_exists($key, $data)) {
                    abort_unless(($record->$key ?? null) === ($data[$key] === null ? null : (int) $data[$key]), 422, 'Induk wilayah tidak dapat dipindahkan. Buat data baru pada wilayah tujuan.');
                }
            }
        }
        $duplicate = $model::whereRaw('lower(name)=lower(?)', [$data['name']]);
        foreach (['kind', 'region_id', 'village_id', 'group_id'] as $key) {
            if (array_key_exists($key, $data)) {
                $duplicate->where($key, $data[$key]);
            }
        }
        $existing = $duplicate->first();
        if ($existing && $existing->id !== $record->id) {
            abort_if($id !== null, 422, 'Nama sudah tersedia pada lingkup ini.');

            return $existing;
        }
        $record->fill($data)->save();

        return $record;
    }

    public function destroy(Request $r, string $kind, int $id)
    {
        $model = $this->model($kind);
        $record = $model::findOrFail($id);
        abort_unless($model === MasterOption::class ? ($record->kind === $kind && $r->user()->manages($record)) : $r->user()->isSuper(), 403);
        try {
            $record->delete();
        } catch (QueryException $e) {
            if ($e->getCode() === '23503') {
                abort(422, 'Data masih digunakan. Ubah data terkait sebelum menghapus.');
            } throw $e;
        }

        return response()->noContent();
    }

    public function brand(Request $r)
    {
        abort_unless($r->user()->isSuper(), 403);
        $data = $r->validate(['name' => 'required|string|max:100', 'subtitle' => 'nullable|string|max:200', 'default_village_id' => 'nullable|integer|exists:villages,id']);
        $brand = BrandSetting::firstOrFail();
        $brand->update($data);

        return $brand;
    }
}
