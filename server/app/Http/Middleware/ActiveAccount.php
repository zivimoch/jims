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
        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
