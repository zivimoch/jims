<?php

namespace App\Http\Controllers;

use App\Events\DataChanged;
use App\Jobs\NotifyActivity;
use App\Jobs\SendPush;
use App\Models\Activity;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Contribution;
use App\Models\Group;
use App\Models\Notice;
use App\Models\PaymentAccount;
use App\Models\PushSubscription;
use App\Models\User;
use App\Models\Village;
use App\Services\Scope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class JimsController extends Controller
{
    private function normalizePhone(Request $r): void
    {
        if (is_string($r->input('phone'))) {
            $r->merge(['phone' => preg_replace('/[\s\p{Z}\-]+/u', '', $r->input('phone'))]);
        }
    }

    public function login(Request $r)
    {
        $this->normalizePhone($r);
        $data = $r->validate(['phone' => ['required', 'string', 'regex:/^08[0-9]{8,11}$/']]);
        $user = User::where('phone', $data['phone'])->where('active', true)->first();
        if (! $user) {
            return response()->json(['message' => 'Nomor WhatsApp belum terdaftar atau akun tidak aktif.'], 422);
        }
        Auth::guard('web')->setRememberDuration(5256000);
        Auth::login($user, true);
        $r->session()->regenerate();

        return ['user' => $r->user()];
    }

    public function logout(Request $r)
    {
        PushSubscription::where('user_id', $r->user()->id)->when($r->input('endpoint'), fn ($q) => $q->where('endpoint_hash', hash('sha256', $r->input('endpoint'))))->when(! $r->input('endpoint'), fn ($q) => $q->whereRaw('1=0'))->delete();
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->noContent();
    }

    public function bootstrap(Request $r)
    {
        $u = $r->user();

        return ['user' => $u->load('group', 'village'), 'villages' => Village::when(! $u->isSuper(), fn ($q) => $q->whereKey($u->village_id))->get(), 'groups' => Group::when(! $u->isSuper(), fn ($q) => $q->where('village_id', $u->village_id))->when(! $u->isSuper() && $u->group_id, fn ($q) => $q->whereKey($u->group_id))->get(), 'reverb_key' => config('broadcasting.connections.reverb.key'), 'vapid_key' => config('services.webpush.public_key')];
    }

    public function activities(Request $r)
    {
        $r->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d', 'search' => 'nullable|string|max:200', 'class' => 'nullable|string|max:60', 'per_page' => 'nullable|integer|min:1|max:100', 'sort' => ['nullable', Rule::in(['asc', 'desc'])]]);
        $query = Scope::visible(Activity::query(), $r->user());
        if ($r->boolean('active')) {
            $query->where('starts_at', '<=', now()->addHours(2))->where('ends_at', '>=', now()->subHours(2));
        }
        if ($r->filled('from')) {
            $query->whereDate('starts_at', '>=', $r->input('from'));
        }
        if ($r->filled('to')) {
            $query->whereDate('starts_at', '<=', $r->input('to'));
        }
        if ($r->filled('search')) {
            $query->where(fn ($q) => $q->where('title', 'ilike', '%'.$r->input('search').'%')->orWhere('location', 'ilike', '%'.$r->input('search').'%'));
        }
        if ($r->filled('class') && $r->input('class') !== 'all') {
            $query->where('class_name', $r->input('class'));
        }
        if ($r->input('group') === 'desa') {
            $query->whereNull('group_id');
        } elseif ($r->filled('group') && $r->input('group') !== 'all') {
            $query->where('group_id', (int) $r->input('group'));
        }

        return $query->with(['group', 'village'])->withCount('attendances')->orderBy('starts_at', $r->input('sort', 'desc'))->orderBy('id')->paginate($r->integer('per_page', 100));
    }

    private function scopeData(Request $r): array
    {
        $d = $r->validate(['village_id' => ['required', 'integer', 'exists:villages,id'], 'group_id' => ['nullable', 'integer', Rule::exists('groups', 'id')->where('village_id', $r->input('village_id'))]]);
        $dWithNull = array_merge($d, ['group_id' => $d['group_id'] ?? null]);
        abort_unless($r->user()->manages((object) $dWithNull), 403);

        return $dWithNull;
    }

    private function audit(Request $r, string $action, $record): void
    {
        AuditLog::create(['actor_id' => $r->user()->id, 'action' => $action, 'entity' => class_basename($record), 'entity_id' => $record->id]);
    }

    public function saveActivity(Request $r, ?Activity $activity = null)
    {
        abort_unless($r->user()->role !== 'jamaah', 403);
        if ($activity?->exists) {
            abort_unless($r->user()->manages($activity), 403);
        }
        $previousScope = $activity?->exists ? [$activity->village_id, $activity->group_id] : null;
        $scope = $this->scopeData($r);
        $d = $r->validate(['title' => 'required|string|max:150', 'location' => 'required|string|max:200', 'class_name' => 'required|string|max:60', 'starts_at' => 'required|date', 'ends_at' => 'required|date|after:starts_at', 'materials' => 'required|array|min:1|max:20', 'materials.*.type' => ['required', Rule::in(['Al-Quran', 'Hadist', 'CAI', 'Nasehat', 'Asad', 'Lainnya'])], 'materials.*.detail' => 'nullable|string|max:300', 'note' => 'nullable|string|max:1000', 'zoom_url' => ['nullable', 'url:https', 'max:500', function ($a, $v, $fail) {
            $host = parse_url($v, PHP_URL_HOST);
            if ($host !== 'zoom.us' && ! str_ends_with($host ?? '', '.zoom.us')) {
                $fail('Gunakan tautan HTTPS Zoom.');
            }
        }]]);
        $saved = DB::transaction(function () use ($r, $activity, $scope, $d) {
            $record = $activity ?? new Activity;
            $record->fill([...$d, ...$scope]);
            if (! $record->exists) {
                $record->created_by = $r->user()->id;
            }
            $record->save();
            $this->audit($r, 'activity.saved', $record);
            NotifyActivity::dispatch($record->id)->afterCommit();

            return $record;
        });
        DataChanged::dispatch($saved->village_id, $saved->group_id);
        if ($previousScope && $previousScope !== [$saved->village_id, $saved->group_id]) {
            DataChanged::dispatch(...$previousScope);
        }

        return $saved;
    }

    public function deleteActivity(Request $r, Activity $activity)
    {
        abort_unless($r->user()->manages($activity), 403);
        $this->audit($r, 'activity.deleted', $activity);
        $activity->delete();
        DataChanged::dispatch($activity->village_id, $activity->group_id);

        return response()->noContent();
    }

    public function attendance(Request $r, Activity $activity)
    {
        abort_unless($r->user()->canSee($activity), 403);
        // Jamaah can see names/status, but never another person's private reason.
        $rows = $activity->attendances()->with('user:id,name,group_id')->orderByDesc('updated_at')->paginate(100);
        $rows->getCollection()->transform(function ($row) use ($r, $activity) {
            if ($row->user_id !== $r->user()->id && ! $r->user()->manages($activity)) {
                $row->makeHidden('reason');
            }

            return $row;
        });

        return ['records' => $rows, 'own' => $activity->attendances()->where('user_id', $r->user()->id)->first()];
    }

    public function saveAttendance(Request $r, Activity $activity)
    {
        $d = $r->validate(['user_id' => 'sometimes|integer|exists:users,id', 'status' => ['required', Rule::in(['offline', 'online', 'izin'])], 'reason' => 'nullable|required_if:status,online,izin|string|max:200']);
        $u = $r->user();
        abort_unless($u->canSee($activity), 403);
        abort_unless(now()->between($activity->starts_at->subHours(2), $activity->ends_at->addHours(2)), 422, 'Absensi tersedia 2 jam sebelum hingga 2 jam sesudah kegiatan.');
        $target = User::findOrFail($d['user_id'] ?? $u->id);
        abort_unless($target->active && $target->canSee($activity), 403);
        if ($target->id !== $u->id) {
            abort_unless($u->manages($activity) && $this->canManageUser($u, $target), 403);
        }
        $record = DB::transaction(function () use ($r, $activity, $target, $u, $d) {
            Attendance::upsert([['activity_id' => $activity->id, 'user_id' => $target->id, 'status' => $d['status'], 'reason' => $d['reason'] ?? null, 'recorded_by' => $u->id, 'created_at' => now(), 'updated_at' => now()]], ['activity_id', 'user_id'], ['status', 'reason', 'recorded_by', 'updated_at']);
            $a = Attendance::where('activity_id', $activity->id)->where('user_id', $target->id)->firstOrFail();
            $this->audit($r, 'attendance.saved', $a);

            return $a;
        });
        DataChanged::dispatch($activity->village_id, $activity->group_id);

        return $record;
    }

    public function cancelAttendance(Request $r, Activity $activity)
    {
        abort_unless($r->user()->canSee($activity), 403);
        abort_unless(now()->between($activity->starts_at->subHours(2), $activity->ends_at->addHours(2)), 422, 'Masa absensi sudah ditutup.');
        $a = $activity->attendances()->where('user_id', $r->user()->id)->first();
        if ($a) {
            $this->audit($r, 'attendance.cancelled', $a);
            $a->delete();
        }DataChanged::dispatch($activity->village_id, $activity->group_id);

        return response()->noContent();
    }

    public function history(Request $r)
    {
        return Attendance::where('user_id', $r->user()->id)->with('activity')->latest('updated_at')->paginate(100);
    }

    private function canManageUser(User $u, User $target): bool
    {
        if ($u->isSuper()) {
            return true;
        }
        if (! $u->manages($target) || $target->isSuper() || $u->id === $target->id) {
            return false;
        }

        return $target->role === 'jamaah' || ($u->group_id === null && $target->group_id !== null);
    }

    public function users(Request $r)
    {
        $u = $r->user();
        abort_if($u->role === 'jamaah', 403);
        $query = User::query();
        if (! $u->isSuper()) {
            $query->where('village_id', $u->village_id)->where('role', '!=', 'super_admin')->where('id', '!=', $u->id);
            if ($u->group_id) {
                $query->where('group_id', $u->group_id)->where('role', 'jamaah');
            } else {
                $query->where(fn ($q) => $q->where('role', 'jamaah')->orWhereNotNull('group_id'));
            }
        }

        return $query->with('group', 'village')->when($r->filled('search'), fn ($q) => $q->where('name', 'ilike', '%'.$r->string('search').'%'))->orderBy('name')->paginate(100);
    }

    public function saveUser(Request $r, ?User $user = null)
    {
        $actor = $r->user();
        abort_if($actor->role === 'jamaah', 403);
        if ($user?->exists) {
            abort_unless($this->canManageUser($actor, $user), 403);
        }
        $this->normalizePhone($r);
        $d = $r->validate(['name' => 'required|string|max:100', 'phone' => ['required', 'string', 'regex:/^08[0-9]{8,11}$/', Rule::unique('users')->ignore($user?->id)], 'role' => ['required', Rule::in(['super_admin', 'pengurus', 'jamaah'])], 'active' => 'required|boolean', 'village_id' => 'nullable|integer|exists:villages,id', 'group_id' => ['nullable', 'integer', Rule::exists('groups', 'id')->where('village_id', $r->input('village_id'))]]);
        if (! $user) {
            $d['password'] = Str::random(64);
        }
        if ($d['role'] !== 'super_admin') {
            abort_unless(! empty($d['village_id']), 422, 'Pilih desa.');
            if ($d['role'] === 'jamaah') {
                abort_unless(! empty($d['group_id']), 422, 'Jamaah harus memiliki kelompok.');
            }
        }
        if (! $actor->isSuper()) {
            abort_unless($d['role'] !== 'super_admin' && $actor->manages((object) ['village_id' => $d['village_id'], 'group_id' => $d['group_id'] ?? null]) && ($d['role'] === 'jamaah' || ($actor->group_id === null && ! empty($d['group_id']))), 403);
        }
        if (empty($d['password'])) {
            unset($d['password']);
        }
        if ($d['role'] === 'super_admin') {
            $d['village_id'] = null;
            $d['group_id'] = null;
        }
        $saved = DB::transaction(function () use ($r, $user, $d) {
            $admins = User::where('role', 'super_admin')->where('active', true)->lockForUpdate()->get();
            if ($user?->isSuper() && $user->active && ($d['role'] !== 'super_admin' || ! $d['active'])) {
                abort_unless($admins->count() > 1, 422, 'Super admin aktif terakhir tidak dapat dinonaktifkan.');
            }
            $record = $user ?? new User;
            $record->fill($d);
            $record->setRememberToken(Str::random(60));
            $record->save();
            $this->audit($r, 'user.saved', $record);
            DB::table('sessions')->where('user_id', $record->id)->delete();
            PushSubscription::where('user_id', $record->id)->delete();

            return $record;
        });
        if ($saved->village_id) {
            DataChanged::dispatch($saved->village_id, $saved->group_id);
        }

        return $saved;
    }

    public function profile(Request $r)
    {
        $d = $r->validate(['name' => 'required|string|max:100']);
        $r->user()->update($d);

        return $r->user();
    }

    public function contributions(Request $r)
    {
        $q = Contribution::with('user:id,name');
        if ($r->user()->role === 'jamaah') {
            $q->where('user_id', $r->user()->id);
        } else {
            Scope::visible($q, $r->user());
        }

        return $q->latest('date')->paginate(100);
    }

    public function saveContribution(Request $r, ?Contribution $contribution = null)
    {
        if ($contribution) {
            abort_unless($r->user()->manages($contribution) || $contribution->user_id === $r->user()->id, 403);
        }
        $d = $r->validate(['category' => ['required', Rule::in(['Kas', 'Tabungan Jalan-jalan'])], 'class_name' => 'required|string|max:60', 'amount' => 'required|integer|min:1|max:1000000000', 'date' => 'required|date_format:Y-m-d', 'note' => 'nullable|string|max:200']);
        $u = $r->user();
        if (! $contribution) {
            abort_unless($u->village_id, 422, 'Pilih akun jamaah/pengurus untuk mencatat shodakoh pribadi.');
        }
        $record = $contribution ?? new Contribution(['user_id' => $u->id, 'village_id' => $u->village_id, 'group_id' => $u->group_id]);
        $record->fill($d)->save();
        $this->audit($r, 'contribution.saved', $record);
        DataChanged::dispatch($record->village_id, $record->group_id);

        return $record;
    }

    public function deleteContribution(Request $r, Contribution $contribution)
    {
        abort_unless($r->user()->manages($contribution) || $contribution->user_id === $r->user()->id, 403);
        $this->audit($r, 'contribution.deleted', $contribution);
        $contribution->delete();
        DataChanged::dispatch($contribution->village_id, $contribution->group_id);

        return response()->noContent();
    }

    public function payments(Request $r)
    {
        return Scope::visible(PaymentAccount::query(), $r->user())->with('group')->get();
    }

    public function savePayment(Request $r, ?PaymentAccount $payment = null)
    {
        if ($payment) {
            abort_unless($r->user()->manages($payment), 403);
        }$scope = $this->scopeData($r);
        $d = $r->validate(['bank' => 'required|string|max:100', 'number' => 'required|string|max:100', 'holder' => 'required|string|max:150', 'is_dummy' => 'required|boolean']);
        $p = $payment ?? new PaymentAccount;
        $p->fill([...$d, ...$scope])->save();
        $this->audit($r, 'payment.saved', $p);
        DataChanged::dispatch($p->village_id, $p->group_id);

        return $p;
    }

    public function deletePayment(Request $r, PaymentAccount $payment)
    {
        abort_unless($r->user()->manages($payment), 403);
        $this->audit($r, 'payment.deleted', $payment);
        $payment->delete();
        DataChanged::dispatch($payment->village_id, $payment->group_id);

        return response()->noContent();
    }

    public function notices(Request $r)
    {
        return Notice::where('user_id', $r->user()->id)->latest()->paginate(30);
    }

    public function readNotice(Request $r, Notice $notice)
    {
        abort_unless($notice->user_id === $r->user()->id, 403);
        $notice->update(['read_at' => now()]);

        return $notice;
    }

    public function subscribe(Request $r)
    {
        $d = $r->validate(['endpoint' => ['required', 'url:https', 'max:2000', function ($a, $v, $fail) {
            $host = parse_url($v, PHP_URL_HOST);
            $allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
            if (! in_array($host, $allowed, true) && ! str_ends_with($host ?? '', '.notify.windows.com')) {
                $fail('Layanan push tidak didukung.');
            }
        }], 'keys.p256dh' => 'required|string|max:255', 'keys.auth' => 'required|string|max:255']);
        PushSubscription::updateOrCreate(['endpoint_hash' => hash('sha256', $d['endpoint'])], ['user_id' => $r->user()->id, 'endpoint' => $d['endpoint'], 'public_key' => $d['keys']['p256dh'], 'auth_token' => $d['keys']['auth']]);

        return response()->noContent();
    }

    public function unsubscribe(Request $r)
    {
        $r->validate(['endpoint' => 'required|string']);
        PushSubscription::where('user_id', $r->user()->id)->where('endpoint_hash', hash('sha256', $r->input('endpoint')))->delete();

        return response()->noContent();
    }

    public function testPush(Request $r)
    {
        SendPush::dispatch($r->user()->id, 'Notifikasi JiMS aktif', 'Anda akan menerima pembaruan kegiatan.');

        return response()->json(['message' => 'Notifikasi uji masuk antrean.']);
    }

    public function auditLogs(Request $r)
    {
        abort_unless($r->user()->isSuper(), 403);

        return AuditLog::latest()->paginate(100);
    }
}
