<?php
/**
 * enviar-lead.php
 *
 * Fluxo:
 * Página -> enviar-lead.php -> n8n -> Kommo
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

/**
 * Aceita somente requisições POST.
 */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'ok' => false,
        'error' => 'method_not_allowed'
    ]);

    exit;
}


/**
 * ============================================================
 * WEBHOOK N8N - PRODUÇÃO
 * ============================================================
 */
const WEBHOOK_URL = 'https://agentes-e-automacao-n8n.bqbb6w.easypanel.host/webhook/c9cc5986-8172-41a0-a37e-1a7d3fdfe412';


/**
 * Limpa textos recebidos.
 */
function texto_limpo($valor, $limite = 500)
{
    if (!is_scalar($valor)) {
        return '';
    }

    $valor = trim(strip_tags((string)$valor));

    $valor = str_replace(
        ["\r", "\n", "\0"],
        ' ',
        $valor
    );

    return mb_substr(
        $valor,
        0,
        $limite,
        'UTF-8'
    );
}


/**
 * Valida pontuações.
 */
function score_valido($valor, $maximo)
{
    if ($valor === null || $valor === '') {
        return null;
    }

    if (filter_var($valor, FILTER_VALIDATE_INT) === false) {
        return null;
    }

    $valor = (int)$valor;

    if ($valor < 0 || $valor > $maximo) {
        return null;
    }

    return $valor;
}


/**
 * ============================================================
 * RECEBE OS DADOS
 * ============================================================
 */

$raw = file_get_contents('php://input');

$data = json_decode($raw, true);

/**
 * Caso não seja JSON, tenta POST tradicional.
 */
if (!is_array($data)) {
    $data = $_POST;
}


/**
 * ============================================================
 * TRATAMENTO DOS DADOS
 * ============================================================
 */

$nome = texto_limpo(
    $data['nome'] ?? '',
    120
);

$telefone = texto_limpo(
    $data['telefone'] ?? '',
    40
);

$email = texto_limpo(
    $data['email'] ?? '',
    180
);

$origem = texto_limpo(
    $data['origem'] ?? 'Sala de Escuta',
    120
);

$pagina = texto_limpo(
    $data['pagina'] ?? '',
    1000
);

$phq9 = score_valido(
    $data['phq9'] ?? null,
    27
);

$gad7 = score_valido(
    $data['gad7'] ?? null,
    21
);


/**
 * ============================================================
 * VALIDAÇÃO
 * ============================================================
 */

if (
    $nome === '' ||
    $telefone === '' ||
    !filter_var($email, FILTER_VALIDATE_EMAIL)
) {

    http_response_code(422);

    echo json_encode([
        'ok' => false,
        'error' => 'dados_invalidos'
    ]);

    exit;
}


/**
 * Verifica se o webhook está configurado corretamente.
 */
if (!filter_var(WEBHOOK_URL, FILTER_VALIDATE_URL)) {

    http_response_code(503);

    echo json_encode([
        'ok' => false,
        'error' => 'webhook_nao_configurado'
    ]);

    exit;
}


/**
 * ============================================================
 * PAYLOAD ENVIADO AO N8N
 * ============================================================
 */

$payload = [

    'evento' => 'novo_lead_sala_escuta',

    'origem' => $origem,

    'lead' => [
        'nome' => $nome,
        'telefone' => $telefone,
        'email' => $email
    ],

    'teste' => [
        'phq9' => $phq9,
        'gad7' => $gad7
    ],

    'contexto' => [
        'pagina' => $pagina,
        'data_hora' => date(DATE_ATOM)
    ]

];


$json = json_encode(
    $payload,
    JSON_UNESCAPED_UNICODE |
    JSON_UNESCAPED_SLASHES
);


/**
 * ============================================================
 * ENVIA PARA O N8N
 * ============================================================
 */

$ch = curl_init(WEBHOOK_URL);

curl_setopt_array(
    $ch,
    [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,

        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,

        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json'
        ],

        CURLOPT_POSTFIELDS => $json
    ]
);


$resposta = curl_exec($ch);

$statusHttp = (int)curl_getinfo(
    $ch,
    CURLINFO_HTTP_CODE
);

$erroCurl = curl_error($ch);

curl_close($ch);


/**
 * ============================================================
 * ERRO DE COMUNICAÇÃO COM N8N
 * ============================================================
 */

if (
    $resposta === false ||
    $erroCurl !== ''
) {

    error_log(
        'Sala de Escuta - erro cURL n8n: ' .
        $erroCurl
    );

    http_response_code(502);

    echo json_encode([
        'ok' => false,
        'error' => 'falha_comunicacao_webhook'
    ]);

    exit;
}


/**
 * ============================================================
 * N8N RESPONDEU COM ERRO
 * ============================================================
 */

if (
    $statusHttp < 200 ||
    $statusHttp >= 300
) {

    error_log(
        'Sala de Escuta - n8n HTTP ' .
        $statusHttp .
        ' resposta: ' .
        mb_substr(
            (string)$resposta,
            0,
            1000
        )
    );

    http_response_code(502);

    echo json_encode([
        'ok' => false,
        'error' => 'webhook_rejeitou',
        'status' => $statusHttp
    ]);

    exit;
}


/**
 * ============================================================
 * SUCESSO
 * ============================================================
 */

echo json_encode([
    'ok' => true
]);