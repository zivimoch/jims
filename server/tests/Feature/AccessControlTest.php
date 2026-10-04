<?php

namespace Tests\Feature;

use App\Events\DataChanged;
use App\Jobs\NotifyActivity;
use App\Models\Activity;
use App\Models\Attendance;
use App\Models\Contribution;
use App\Models\Group;
use App\Models\Notice;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $desa;

    private User $group1;

    private User $group2;

    private User $jamaah;

    private User $other;

    private Village $village;

    private Group $g1;

    private Group $g2;

    private Activity $activity;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([DataChanged::class]);
        Queue::fake();
        $this->village = Village::create(['name' => 'Desa A']);
        $this->g1 = Group::create(['name' => 'Kelompok 1', 'village_id' => $this->village->id]);
        $this->g2 = Group::create(['name' => 'Kelompok 2', 'village_id' => $this->village->id]);
        $this->admin = $this->user('super_admin');
        $this->desa = $this->user('pengurus');
        $this->group1 = $this->user('pengurus', $this->g1->id);
        $this->group2 = $this->user('pengurus', $this->g2->id);
        $this->jamaah = $this->user('jamaah', $this->g1->id);
        $this->other = $this->user('jamaah', $this->g2->id);
        $this->activity = Activity::create([...$this->activityData(), 'created_by' => $this->admin->id]);
    }

    private function user(string $role, ?int $group = null): User
    {
        return User::factory()->create(['role' => $role, 'village_id' => $role === 'super_admin' ? null : $this->village->id, 'group_id' => $group, 'active' => true]);
    }

    private function activityData(): array
    {
        return ['village_id' => $this->village->id, 'group_id' => $this->g1->id, 'title' => 'Pengajian kelompok 1', 'location' => 'Al-Barokah', 'class_name' => 'Umum', 'starts_at' => now()->subMinutes(30)->toIso8601String(), 'ends_at' => now()->addHour()->toIso8601String(), 'materials' => [['type' => 'Nasehat', 'detail' => 'Kerukunan']]];
    }

    private function userData(User $u): array
    {
        return ['name' => $u->name, 'email' => $u->email, 'role' => $u->role, 'village_id' => $u->village_id, 'group_id' => $u->group_id, 'active' => true];
    }

    public function test_guests_cannot_read_private_api(): void
    {
        $this->getJson('/api/activities')->assertUnauthorized();
    }

    public function test_jamaah_cannot_mutate_ami_even_with_forged_request(): void
    {
        $this->actingAs($this->jamaah)->postJson('/api/activities', $this->activityData())->assertForbidden();
        $this->putJson('/api/activities/'.$this->activity->id, $this->activityData())->assertForbidden();
        $this->deleteJson('/api/activities/'.$this->activity->id)->assertForbidden();
    }

    public function test_pengurus_cannot_read_or_modify_other_group(): void
    {
        $this->actingAs($this->group2)->getJson('/api/activities')->assertJsonCount(0, 'data');
        $this->putJson('/api/activities/'.$this->activity->id, $this->activityData())->assertForbidden();
        $this->getJson('/api/activities/'.$this->activity->id.'/attendance')->assertForbidden();
    }

    public function test_pengurus_cannot_promote_self_or_jamaah_to_super_admin(): void
    {
        $this->actingAs($this->group1)->putJson('/api/users/'.$this->group1->id, [...$this->userData($this->group1), 'role' => 'super_admin'])->assertForbidden();
        $this->putJson('/api/users/'.$this->jamaah->id, [...$this->userData($this->jamaah), 'role' => 'super_admin'])->assertForbidden();
    }

    public function test_desa_manages_child_group_and_admin_manages_all(): void
    {
        $this->actingAs($this->desa)->putJson('/api/activities/'.$this->activity->id, $this->activityData())->assertOk();
        $this->putJson('/api/users/'.$this->group1->id, $this->userData($this->group1))->assertOk();
        $this->actingAs($this->admin)->putJson('/api/users/'.$this->desa->id, $this->userData($this->desa))->assertOk();
        Queue::assertPushed(NotifyActivity::class);
    }

    public function test_desa_cannot_manage_other_village(): void
    {
        $v = Village::create(['name' => 'Desa B']);
        $other = $this->user('pengurus');
        $other->update(['village_id' => $v->id]);
        $this->actingAs($this->desa)->putJson('/api/users/'.$other->id, $this->userData($other))->assertForbidden();
    }

    public function test_group_and_village_must_match(): void
    {
        $v = Village::create(['name' => 'Desa B']);
        $g = Group::create(['name' => 'Kelompok 1', 'village_id' => $v->id]);
        $this->actingAs($this->admin)->postJson('/api/activities', [...$this->activityData(), 'group_id' => $g->id])->assertUnprocessable();
    }

    public function test_jamaah_own_attendance_is_idempotent_and_audited(): void
    {
        $path = '/api/activities/'.$this->activity->id.'/attendance';
        $this->actingAs($this->jamaah)->postJson($path, ['status' => 'offline'])->assertOk();
        $this->postJson($path, ['status' => 'offline'])->assertOk();
        $this->assertDatabaseCount('attendances', 1);
        $this->assertDatabaseHas('attendances', ['recorded_by' => $this->jamaah->id, 'user_id' => $this->jamaah->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'attendance.saved']);
        Event::assertDispatched(DataChanged::class);
    }

    public function test_jamaah_cannot_attend_for_others(): void
    {
        $this->actingAs($this->jamaah)->postJson('/api/activities/'.$this->activity->id.'/attendance', ['status' => 'offline', 'user_id' => $this->group1->id])->assertForbidden();
    }

    public function test_pengurus_can_attend_for_own_jamaah_only(): void
    {
        $path = '/api/activities/'.$this->activity->id.'/attendance';
        $this->actingAs($this->group1)->postJson($path, ['status' => 'offline', 'user_id' => $this->jamaah->id])->assertOk();
        $this->postJson($path, ['status' => 'offline', 'user_id' => $this->other->id])->assertForbidden();
        $this->assertDatabaseHas('attendances', ['recorded_by' => $this->group1->id, 'user_id' => $this->jamaah->id]);
    }

    public function test_attendance_window_and_reason_validation(): void
    {
        $path = '/api/activities/'.$this->activity->id.'/attendance';
        $this->actingAs($this->jamaah)->postJson($path, ['status' => 'izin'])->assertUnprocessable();
        $this->activity->update(['starts_at' => now()->subDays(2), 'ends_at' => now()->subDay()]);
        $this->postJson($path, ['status' => 'offline'])->assertUnprocessable();
    }

    public function test_jamaah_can_view_desa_activity_but_group_manager_cannot_edit_it(): void
    {
        $this->activity->update(['group_id' => null]);
        $this->actingAs($this->jamaah)->getJson('/api/activities')->assertJsonCount(1, 'data');
        $this->actingAs($this->group1)->putJson('/api/activities/'.$this->activity->id, $this->activityData())->assertForbidden();
    }

    public function test_private_reasons_not_exposed_to_other_jamaah(): void
    {
        $peer = $this->user('jamaah', $this->g1->id);
        Attendance::create(['activity_id' => $this->activity->id, 'user_id' => $peer->id, 'recorded_by' => $peer->id, 'status' => 'izin', 'reason' => 'Private reason']);
        $this->actingAs($this->jamaah)->getJson('/api/activities/'.$this->activity->id.'/attendance')->assertOk()->assertJsonMissing(['reason' => 'Private reason']);
    }

    public function test_disabled_account_cannot_use_existing_session(): void
    {
        $this->jamaah->update(['active' => false]);
        $this->actingAs($this->jamaah)->getJson('/api/bootstrap')->assertUnauthorized();
    }

    public function test_last_active_super_admin_is_protected(): void
    {
        $this->actingAs($this->admin)->putJson('/api/users/'.$this->admin->id, [...$this->userData($this->admin), 'active' => false])->assertUnprocessable();
    }

    public function test_jamaah_cannot_enumerate_users_or_audit_logs(): void
    {
        $this->actingAs($this->jamaah)->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/audit')->assertForbidden();
    }

    public function test_private_broadcast_channels_are_scoped(): void
    {
        $this->actingAs($this->group2)->postJson('/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-group.'.$this->g1->id])->assertForbidden();
        $this->actingAs($this->group1)->postJson('/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-group.'.$this->g1->id])->assertOk();
    }

    public function test_push_endpoint_cannot_target_internal_services(): void
    {
        $this->actingAs($this->jamaah)->postJson('/api/push', ['endpoint' => 'https://127.0.0.1/internal', 'keys' => ['p256dh' => 'x', 'auth' => 'y']])->assertUnprocessable();
    }

    public function test_jamaah_cannot_read_or_change_others_contributions(): void
    {
        $c = Contribution::create(['user_id' => $this->other->id, 'village_id' => $this->village->id, 'group_id' => $this->g2->id, 'category' => 'Kas', 'class_name' => 'Umum', 'amount' => 10000, 'date' => now()->toDateString()]);
        $this->actingAs($this->jamaah)->getJson('/api/contributions')->assertJsonCount(0, 'data');
        $this->deleteJson('/api/contributions/'.$c->id)->assertForbidden();
    }

    public function test_notice_read_requires_ownership(): void
    {
        $n = Notice::create(['user_id' => $this->other->id, 'title' => 'Private', 'body' => 'Private']);
        $this->actingAs($this->jamaah)->patchJson('/api/notices/'.$n->id)->assertForbidden();
    }
}
