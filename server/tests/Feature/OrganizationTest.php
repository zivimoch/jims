<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\DapukanType;
use App\Models\Group;
use App\Models\MasterOption;
use App\Models\Region;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OrganizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Region $region;

    private Village $village;

    private Group $group;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
        Queue::fake();
        $this->admin = User::factory()->create(['role' => 'super_admin', 'active' => true]);
        $this->region = Region::create(['name' => 'Daerah A']);
        $this->village = Village::create(['name' => 'Desa A', 'region_id' => $this->region->id]);
        $this->group = Group::create(['name' => 'Kelompok A', 'village_id' => $this->village->id]);
    }

    private function user(string $role = 'jamaah'): User
    {
        return User::factory()->create(['role' => $role, 'region_id' => $this->region->id, 'village_id' => $this->village->id, 'group_id' => $this->group->id, 'active' => true]);
    }

    private function assignment(?Village $v = null, ?Group $g = null): array
    {
        return ['dapukan_type_id' => DapukanType::first()->id, 'region_id' => $this->region->id, 'village_id' => $v?->id, 'group_id' => $g?->id];
    }

    private function agenda(array $extra = []): array
    {
        return [...['title' => 'Pengajian', 'location' => 'Masjid', 'village_id' => $this->village->id, 'group_id' => null, 'class_name' => 'Umum', 'starts_at' => now()->subMinutes(10)->toIso8601String(), 'ends_at' => now()->addHour()->toIso8601String(), 'materials' => []], ...$extra];
    }

    public function test_multiple_dapukans_grant_union_of_scopes_but_not_other_regions(): void
    {
        $u = $this->user('pengurus');
        $u->dapukans()->createMany([$this->assignment($this->village, $this->group), $this->assignment()]);
        $second = Village::create(['name' => 'Desa B', 'region_id' => $this->region->id]);
        $outside = Village::create(['name' => 'Desa Luar', 'region_id' => Region::create(['name' => 'Daerah Luar'])->id]);
        $this->actingAs($u)->postJson('/api/activities', $this->agenda(['village_id' => $second->id]))->assertCreated();
        $this->postJson('/api/activities', $this->agenda(['village_id' => $outside->id]))->assertForbidden();
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonCount(2, 'villages')->assertJsonCount(1, 'groups');
        $this->getJson('/api/activities')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/bootstrap')->assertJsonPath('user.dapukans.0.label', 'Kiyai Kelompok')->assertJsonPath('user.dapukans.1.label', 'Kiyai Daerah');
    }

    public function test_assignment_does_not_grant_home_village_management(): void
    {
        $u = $this->user('pengurus');
        $other = Village::create(['name' => 'Desa tugas', 'region_id' => $this->region->id]);
        $u->dapukans()->create($this->assignment($other));
        $this->actingAs($u)->postJson('/api/activities', $this->agenda())->assertForbidden();
        $this->postJson('/api/activities', $this->agenda(['village_id' => $other->id]))->assertCreated();
    }

    public function test_only_super_admin_assigns_dapukans_and_validates_parent_chain(): void
    {
        $target = $this->user();
        $data = ['name' => $target->name, 'phone' => $target->phone, 'role' => 'pengurus', 'active' => true, 'region_id' => $this->region->id, 'village_id' => $this->village->id, 'group_id' => $this->group->id, 'dapukans' => [$this->assignment($this->village), $this->assignment($this->village, $this->group)]];
        $this->actingAs($this->admin)->putJson('/api/users/'.$target->id, $data)->assertOk();
        $this->assertSame(2, $target->dapukans()->count());
        $outside = Region::create(['name' => 'Luar']);
        $data['dapukans'][0]['region_id'] = $outside->id;
        $this->putJson('/api/users/'.$target->id, $data)->assertUnprocessable();
        $manager = $this->user('pengurus');
        $this->actingAs($manager)->putJson('/api/users/'.$target->id, $data)->assertForbidden();
    }

    public function test_group_dapukan_can_read_parent_agenda_without_managing_it(): void
    {
        $u = $this->user('pengurus');
        $v = Village::create(['name' => 'Desa Tugas', 'region_id' => $this->region->id]);
        $g = Group::create(['name' => 'Kelompok Tugas', 'village_id' => $v->id]);
        $u->dapukans()->create($this->assignment($v, $g));
        $activity = Activity::create([...$this->agenda(['village_id' => $v->id]), 'created_by' => $this->admin->id]);
        $this->actingAs($u)->getJson('/api/activities')->assertJsonCount(1, 'data');
        $this->getJson('/api/bootstrap')->assertJsonCount(2, 'villages');
        $this->deleteJson('/api/activities/'.$activity->id)->assertForbidden();
    }

    public function test_profile_allows_personal_fields_but_rejects_territory_and_role(): void
    {
        $u = $this->user();
        $this->actingAs($u)->patchJson('/api/profile', ['name' => 'Nama baru', 'phone' => '0812 5555-1234', 'address' => 'Jalan Contoh'])->assertOk()->assertJsonPath('phone', '081255551234');
        foreach (['region_id' => $this->region->id, 'village_id' => $this->village->id, 'group_id' => $this->group->id, 'role' => 'super_admin', 'dapukans' => [$this->assignment()]] as $key => $value) {
            $this->patchJson('/api/profile', ['name' => 'Nama baru', $key => $value])->assertUnprocessable();
        }
    }

    public function test_master_permissions_search_typo_and_duplicate_reuse(): void
    {
        $u = $this->user('pengurus');
        $this->actingAs($u)->postJson('/api/masters/class', ['name' => 'Caberawit', 'village_id' => $this->village->id, 'group_id' => $this->group->id])->assertCreated();
        $this->getJson('/api/masters/class?q=Caberwit')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Caberawit');
        $this->postJson('/api/masters/class', ['name' => ' caberawit ', 'village_id' => $this->village->id, 'group_id' => $this->group->id])->assertOk();
        $this->assertSame(1, MasterOption::where('kind', 'class')->count());
        $this->postJson('/api/masters/dapukan', ['name' => 'Sekretaris'])->assertForbidden();
        $jamaah = $this->user();
        $this->actingAs($jamaah)->postJson('/api/masters/class', ['name' => 'Baru', 'village_id' => $this->village->id])->assertForbidden();
        $other = Group::create(['name' => 'Rahasia', 'village_id' => $this->village->id]);
        MasterOption::create(['kind' => 'class', 'name' => 'Kelas Rahasia', 'village_id' => $this->village->id, 'group_id' => $other->id]);
        $this->getJson('/api/masters/class?q=Rahasia')->assertJsonCount(0);
    }

    public function test_multiple_required_classes_and_disabled_attendance(): void
    {
        $a = MasterOption::create(['kind' => 'class', 'name' => 'Remaja', 'village_id' => $this->village->id]);
        $b = MasterOption::create(['kind' => 'class', 'name' => 'Umum', 'village_id' => $this->village->id]);
        $created = $this->actingAs($this->admin)->postJson('/api/activities', $this->agenda(['required_class_ids' => [$a->id, $b->id], 'attendance_enabled' => false]))->assertCreated();
        $id = $created->json('id');
        $this->assertSame(2, Activity::find($id)->requiredClasses()->count());
        $this->getJson('/api/activities?active=1')->assertJsonCount(0, 'data');
        $this->getJson('/api/activities')->assertJsonCount(2, 'data.0.required_classes');
        $this->postJson('/api/activities/'.$id.'/attendance', ['status' => 'offline'])->assertUnprocessable();
        $this->deleteJson('/api/masters/class/'.$a->id)->assertUnprocessable();
    }

    public function test_class_from_other_village_cannot_be_required(): void
    {
        $v = Village::create(['name' => 'B', 'region_id' => $this->region->id]);
        $c = MasterOption::create(['kind' => 'class', 'name' => 'Luar', 'village_id' => $v->id]);
        $this->actingAs($this->admin)->postJson('/api/activities', $this->agenda(['required_class_ids' => [$c->id]]))->assertUnprocessable();
    }

    public function test_brand_changes_public_page_and_manifest(): void
    {
        $this->actingAs($this->admin)->putJson('/api/brand', ['name' => 'Jamaah Kita', 'subtitle' => 'Daerah A', 'default_village_id' => $this->village->id])->assertOk();
        $this->get('/')->assertSee('Jamaah Kita');
        $this->getJson('/manifest.webmanifest')->assertJsonPath('name', 'Jamaah Kita');
        $this->actingAs($this->user())->putJson('/api/brand', ['name' => 'Palsu'])->assertForbidden();
    }
}
