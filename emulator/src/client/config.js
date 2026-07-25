/// <reference path="core.js" />

$(async () => {
    const {result} = await callAPI('/api/util/config');

    for (const i in result) {
        if (!Object.prototype.hasOwnProperty.call(result, i)) {
            continue;
        }

        const $input = $(`input[data-json-path='${i}'],select[data-json-path='${i}']`);

        $input.val(result[i].toString());
    }

    $('button').not('.danger').on('click', async (e) => {
        const $button = $(e.target);
        const $input = $button.siblings('input,select');
        const jsonPath = $input.data("json-path");

        let val;

        if (typeof result[jsonPath] === 'boolean') {
            val = $input.val() === 'true';
        }
        else {
            val = $input.val();
        }
        
        if ($input.attr('type') === 'number') {
            val = parseInt(val);
        }

        result[jsonPath] = val;

        if (!await showYesNo(formatI18n('config.changeConfirmHtml', {env: $input.data('env'), val}), t('config.changeTitle'))) {
            return;
        }

        const patchResult = await callAPI('/api/util/config', 'PATCH', result);

        if (patchResult.status >= 300) {
            await showAlert(formatI18n('config.updateFailedHtml', {error: patchResult.result}));
        }
    });

    $('.buttons > button').on('click', async () => {
        const config = JSON.parse(JSON.stringify(result));
        config.webhook['clientSecret'] = "&lt;redacted&gt;";
        await showDialog('<pre>' + highlightJson(JSON.stringify(config, undefined, 2)) + '</pre>', t('config.rawTitle'));
    });
});

async function clear_click() {
    if (!await showYesNo(t("config.clearConfirmHtml"), t("config.clearTitle"))) {
        return;
    }

    await callAPI('/api/util/data-file', 'DELETE');
}