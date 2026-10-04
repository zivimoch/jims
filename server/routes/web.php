<?php

use App\Http\Controllers\JimsController as J;
use App\Http\Middleware\ActiveAccount;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->view('app')->header('Cache-Control', 'no-store, private'))->name('login');
Route::post('/api/login', [J::class, 'login'])->middleware('throttle:5,1');
Route::middleware(['auth', ActiveAccount::class, 'throttle:180,1'])->prefix('api')->group(function () {
    Route::post('/logout', [J::class, 'logout']);
    Route::get('/bootstrap', [J::class, 'bootstrap']);
    Route::patch('/profile', [J::class, 'profile']);
    Route::get('/activities', [J::class, 'activities']);
    Route::post('/activities', [J::class, 'saveActivity']);
    Route::put('/activities/{activity}', [J::class, 'saveActivity']);
    Route::delete('/activities/{activity}', [J::class, 'deleteActivity']);
    Route::get('/activities/{activity}/attendance', [J::class, 'attendance']);
    Route::post('/activities/{activity}/attendance', [J::class, 'saveAttendance']);
    Route::delete('/activities/{activity}/attendance', [J::class, 'cancelAttendance']);
    Route::get('/history', [J::class, 'history']);
    Route::get('/users', [J::class, 'users']);
    Route::post('/users', [J::class, 'saveUser']);
    Route::put('/users/{user}', [J::class, 'saveUser']);
    Route::get('/contributions', [J::class, 'contributions']);
    Route::post('/contributions', [J::class, 'saveContribution']);
    Route::put('/contributions/{contribution}', [J::class, 'saveContribution']);
    Route::delete('/contributions/{contribution}', [J::class, 'deleteContribution']);
    Route::get('/payments', [J::class, 'payments']);
    Route::post('/payments', [J::class, 'savePayment']);
    Route::put('/payments/{payment}', [J::class, 'savePayment']);
    Route::delete('/payments/{payment}', [J::class, 'deletePayment']);
    Route::get('/notices', [J::class, 'notices']);
    Route::patch('/notices/{notice}', [J::class, 'readNotice']);
    Route::post('/push', [J::class, 'subscribe']);
    Route::delete('/push', [J::class, 'unsubscribe']);
    Route::post('/push/test', [J::class, 'testPush'])->middleware('throttle:3,1');
    Route::get('/audit', [J::class, 'auditLogs']);
});
