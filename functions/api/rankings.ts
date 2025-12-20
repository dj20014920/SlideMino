interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const { results } = await env.DB.prepare(
            'SELECT name, score, difficulty FROM rankings ORDER BY score DESC LIMIT 50'
        ).all();

        return new Response(JSON.stringify(results), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
    }
};
