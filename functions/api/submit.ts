interface Env {
    DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;

    try {
        const data = await request.json() as any;

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // 1. Input Validation
        if (!data.name || data.name.length > 20) {
            return new Response('Invalid name', { status: 400, headers: corsHeaders });
        }
        if (typeof data.score !== 'number' || data.score < 0) {
            return new Response('Invalid score', { status: 400, headers: corsHeaders });
        }

        // 2. Anti-Cheat Heuristics
        // Example: 5000 points per second cap
        if (data.duration > 0 && (data.score / data.duration) > 5000) {
            return new Response('Score rejected: Rate too high', { status: 403, headers: corsHeaders });
        }
        // Example: Too fast
        if (data.score > 100 && data.duration < 5) {
            return new Response('Score rejected: Too fast', { status: 403, headers: corsHeaders });
        }

        // 3. Insert into D1
        // Note: 'rankings' table must exist in the D1 database bound to this Pages project
        await env.DB.prepare(
            'INSERT INTO rankings (name, score, difficulty, duration, moves, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(data.name, data.score, data.difficulty, data.duration, data.moves, Date.now()).run();

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
