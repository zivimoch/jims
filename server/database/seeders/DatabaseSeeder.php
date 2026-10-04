<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Attendance;
use App\Models\Contribution;
use App\Models\Group;
use App\Models\Notice;
use App\Models\PaymentAccount;
use App\Models\User;
use App\Models\Village;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('Seeder dummy tidak boleh dijalankan di production.');
        }
        $password = env('DEMO_PASSWORD');
        if (! $password || strlen($password) < 12) {
            throw new \RuntimeException('Isi DEMO_PASSWORD minimal 12 karakter.');
        }
        $hash = Hash::make($password);
        $v = Village::firstOrCreate(['name' => 'Jati Perhubungan']);
        $make = function ($email, $name, $role, $group = null) use ($v, $hash) {
            return User::firstOrCreate(['email' => $email], ['name' => $name, 'password' => $hash, 'role' => $role, 'village_id' => $role === 'super_admin' ? null : $v->id, 'group_id' => $group, 'active' => true]);
        };
        $admin = $make('admin@jims.test', 'Super Admin', 'super_admin');
        $make('desa@jims.test', 'Pengurus Desa', 'pengurus');
        PaymentAccount::firstOrCreate(['village_id' => $v->id, 'group_id' => null], ['bank' => 'Bank Contoh', 'number' => '0000 0000 0000', 'holder' => 'Bendahara Desa (Dummy)', 'is_dummy' => true]);
        $names = ['Alex Ferguson', 'Raka Pratama', 'Ahmad Hidayat', 'Muhammad Fikri', 'Dimas Ramadhan', 'Fajar Maulana', 'Rizky Saputra', 'Budi Santoso', 'Ilham Ramadhan', 'Arif Setiawan'];
        for ($i = 1; $i <= 3; $i++) {
            $g = Group::firstOrCreate(['village_id' => $v->id, 'name' => 'Kelompok '.$i]);
            $make("kelompok{$i}@jims.test", "Pengurus Kelompok {$i}", 'pengurus', $g->id);
            PaymentAccount::firstOrCreate(['village_id' => $v->id, 'group_id' => $g->id], ['bank' => 'Bank Contoh', 'number' => "0000 0000 000{$i}", 'holder' => "Bendahara Kelompok {$i} (Dummy)", 'is_dummy' => true]);
            $activity = Activity::firstOrCreate(['title' => "Sambung Kelompok {$i}", 'village_id' => $v->id, 'group_id' => $g->id], ['location' => ['Al-Barokah', 'Al-Manshurin', 'Al-Hikmah'][$i - 1], 'class_name' => 'Umum', 'starts_at' => now()->startOfDay()->addHours(5), 'ends_at' => now()->startOfDay()->addHours(22), 'materials' => [['type' => 'Al-Quran', 'detail' => '2:213'], ['type' => 'Hadist', 'detail' => 'K.Khotbah Hal. 20 · Jilid 1'], ['type' => 'Nasehat', 'detail' => '']], 'note' => 'Kegiatan contoh untuk mencoba JiMS.', 'created_by' => $admin->id]);
            foreach ($names as $n => $name) {
                $u = $make($n === 0 ? "jamaah{$i}@jims.test" : "jamaah{$i}.{$n}@jims.test", $name.($i > 1 ? " {$i}" : ''), 'jamaah', $g->id);
                if ($n > 0) {
                    Attendance::firstOrCreate(['activity_id' => $activity->id, 'user_id' => $u->id], ['recorded_by' => $admin->id, 'status' => $n % 3 === 0 ? 'online' : 'offline', 'reason' => $n % 3 === 0 ? 'Bekerja' : null]);
                }
                Contribution::firstOrCreate(['user_id' => $u->id, 'category' => 'Kas', 'date' => now()->toDateString()], ['village_id' => $v->id, 'group_id' => $g->id, 'class_name' => 'Umum', 'amount' => 10000 + ($n * 1000), 'note' => 'Data dummy, bukan pembayaran terverifikasi.']);
                Notice::firstOrCreate(['user_id' => $u->id, 'title' => 'Selamat datang di JiMS'], ['body' => 'Pilih kegiatan dan lokasi sebelum melakukan absensi.']);
            }
        }
        Activity::firstOrCreate(['title' => 'Pengajian Muda-Mudi Desa', 'village_id' => $v->id, 'group_id' => null], ['location' => 'Mesjid Al Barokah Lantai 1', 'class_name' => 'Remaja', 'starts_at' => now()->setTime(20, 0), 'ends_at' => now()->setTime(21, 30), 'materials' => [['type' => 'Nasehat', 'detail' => 'Kerukunan']], 'note' => 'Kegiatan contoh untuk mencoba JiMS.', 'created_by' => $admin->id]);
    }
}
