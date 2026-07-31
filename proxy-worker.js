// Cloudflare API CORS Proxy Worker
// This worker proxies requests to Cloudflare API with proper CORS headers
export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const target = url.searchParams.get('url');
        const body = url.searchParams.get('body');
        const method = url.searchParams.get('method') || request.method;

        if (!target) {
            return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            const headers = {};
            const authHeader = request.headers.get('Authorization');
            if (authHeader) headers['Authorization'] = authHeader;
            headers['Content-Type'] = 'application/json';

            const fetchOpts = { method, headers };
            if (body && method !== 'GET') {
                fetchOpts.body = body;
            }

            const response = await fetch(target, fetchOpts);
            const data = await response.text();

            return new Response(data, {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};