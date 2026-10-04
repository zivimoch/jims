<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ActiveAccount
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->user()?->active) {
            auth()->logout();
            $request->session()->invalidate();
            abort(401, 'Akun tidak aktif.');
        }
        // Refresh the persistent cookie when restoring an expired session.
        if (auth()->viaRemember()) {
            auth()->setRememberDuration(5256000);
            auth()->login($request->user(), true);
        }
        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
