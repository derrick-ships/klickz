export function GET() {
 return Response.json({client_id:"https://openpikzels.com/integrations/local-companion/client.json",client_name:"OpenPikzels local companion",client_uri:"https://openpikzels.com/local-companion",redirect_uris:["http://127.0.0.1:48763/api/mcp/oauth/callback"],grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_method:"none"},{headers:{"Cache-Control":"public, max-age=300"}});
}
