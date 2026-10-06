<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class PhoneLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_normalizes_phone_and_remembers_user_without_password(): void
    {
        $user = User::factory()->create(['phone' => '081234567890', 'active' => true]);
        $response = $this->postJson('/api/login', ['phone' => '0812 3456-7890']);
        $response->assertOk()->assertJsonPath('user.id', $user->id);
        $response->assertCookie(Auth::guard('web')->getRecallerName());
        $this->assertAuthenticatedAs($user);
    }

    public function test_special_admin_number_can_login_but_other_zero_numbers_cannot(): void
    {
        $admin = User::factory()->create(['phone' => '000000000000', 'role' => 'super_admin', 'active' => true]);
        $this->postJson('/api/login', ['phone' => '00000000000'])->assertUnprocessable();
        $this->postJson('/api/login', ['phone' => '000000000000'])->assertOk()->assertJsonPath('user.id', $admin->id);
    }

    public function test_international_prefix_and_unknown_or_inactive_numbers_are_rejected(): void
    {
        User::factory()->create(['phone' => '081234567890', 'active' => false]);
        foreach (['6281234567890', '+6281234567890', '081234567890', '089999999999'] as $phone) {
            $this->postJson('/api/login', ['phone' => $phone])->assertUnprocessable();
            $this->assertGuest();
        }
    }

    public function test_remember_cookie_restores_login_without_old_session_and_logout_revokes_it(): void
    {
        $user = User::factory()->create(['phone' => '081234567890', 'active' => true]);
        $response = $this->postJson('/api/login', ['phone' => $user->phone]);
        $name = Auth::guard('web')->getRecallerName();
        $cookie = $response->getCookie($name)->getValue();
        $this->app['session']->driver()->flush();
        Auth::forgetGuards();
        $this->withCredentials()->withCookie($name, $cookie)->getJson('/api/bootstrap')->assertOk()->assertJsonPath('user.id', $user->id)->assertCookie($name);
        $this->assertTrue(Auth::guard('web')->viaRemember());
        $this->postJson('/api/logout')->assertNoContent();
        Auth::forgetGuards();
        $this->withCredentials()->withCookie($name, $cookie)->getJson('/api/bootstrap')->assertUnauthorized();
    }

    public function test_admin_creates_account_without_email_or_password_and_prevents_duplicate_phone(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'active' => true]);
        $data = ['name' => 'Admin baru', 'phone' => '0812 3456-7890', 'role' => 'super_admin', 'active' => true];
        $this->actingAs($admin)->postJson('/api/users', $data)->assertCreated()->assertJsonPath('phone', '081234567890');
        $this->postJson('/api/users', $data)->assertUnprocessable()->assertJsonValidationErrors('phone');
    }
}
