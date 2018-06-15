const request = require('request-promise');
const config = require('config');
const md5 = require('md5');
const db = require('./lib/db');

const TYPE_STANDARD_TOOT = 0;
const TYPE_OUTER_BOOST = 1;
const TYPE_INNER_BOOST = 2;
const TYPE_OUTER_REPLY = 3;
const TYPE_INNER_REPLY = 4;

async function get_request(url, optional = {}) {
    let resource;
    let result;
    let options = {
        resolveWithFullResponse: true,
    };

    if (optional.headers) {
        options = { ...options, headers: headers };
    }

    if (config.token) {
        options = { ...options, 'auth': { 'bearer': config.token } };
    }

    try {
        resource = await request(url, options);
        result = {
            headers: resource.headers,
            payload: JSON.parse(resource.body)
        }
    } catch(e) {
        console.log(e.message);
        console.log(url);
        //result = Promise.reject(e);
    }

    return result;
}

function generate_api(path, params = {}) {
    let p = "";

    if (!config.domain) return false;
    if (!path.match(/^\//)) path = '/api/v1/' + path;

    Object.keys(params).forEach((key) => {
        p += (p ? '&' : '?') + key + '=' + params[key];
    })

    return "https://" + config.domain + path + p;
}

async function get_public_timeline(max_id = "") {
    let optional = {};
    let params = { limit: 2 };

    if (max_id) {
        params['max_id'] = max_id;
    }
    let api = generate_api('timelines/public', params);

    try {
        let response = await get_request(api, optional);
        return response;
    }
    catch (e) {
        return Promise.reject("public timeline requesting error");
    }
}

async function get_account_statuses(id, repeat, max_id = "") {
    let response;
    let params = { limit: 100 };
    if (!(repeat >= 0)) repeat = 5;
    if (max_id) params['max_id'] = max_id;
    let api = generate_api('accounts/' + id + '/statuses', params);
    debug_log(repeat + " " + api);
    try {
        response = await get_request(api);
        await wait(config.timewait);
        max_id = response.payload.reduce((min, next) => min < next.id ? min : next.id);
        return (repeat
                ? response.payload.concat(await get_account_statuses(id, --repeat, max_id))
                : (response.payload || []));
    }
    catch (e) {
        return [];
    }
}

async function get_account_following(account, max_id = "") {
    if (!account.id) return [];
    let response, next;
    let params = { limit: 100 };
    let following;
    let id = account.id;
    if (max_id) params['max_id'] = max_id;
    let api = generate_api('accounts/' + id + '/following', params);

    response = await get_request(api);
    if (response.headers.link) {
        next = response.headers.link.match(/max_id=(\d+)/);
        await wait(config.timewait);
    }
    return next ? response.payload.concat(await get_account_following(id, next[1])) : response.payload;
}

function encode_md5(text) {
    config.salt = config.salt || md5(Math.random());
    return md5(text + config.salt);
}

async function insert_user(account) {
    let response;
    let user = encode_md5(account.acct);
    let domain = account.url.match(/https?:\/\/([^/]+)/)[1];
    let sql = 'insert into users ( user, domain, following, followed ) values ( ?, ?, ?, ? )';
    try {
        await db.insert(sql, [user, domain, account.following_count, account.followers_count]);
        debug_log("OK: " + account.acct);
        //response = await get_account_following(status.account.id);
        //console.log(status.account.id + " account followings:", response.map((acc) => acc.acct));
        //await insert_followings(response);
        response = await get_account_statuses(account.id, 4);
        insert_statuses(response);
        //await insert_followings(response);
    }
    catch (e) {
        console.log(e)
        return false;
        //console.log ("NG(" + status.id + "): " + status.account.acct);
    }
    try {
        let results = await Promise.all([
            db.select('select count(user) as user from users'),
            db.select('select sum(length) as length from statuses')
        ]);
        console.log(results[0]['user'] + ' accounts, ' + results[1]['length'] + ' statuses.');
    }
    catch(e) {
        console.log('select error.');
    }
    return domain;
}

function insert_followings(accounts) {}

function insert_statuses(statuses) {
    if (!statuses || !statuses.length) return;
    let statistics = {
        status_length: statuses.length,
        status_boosts: statuses.filter((s) => s.reblog ? true : false).length,
        outer_boost: statuses.filter((s) => status_type(s) === TYPE_OUTER_BOOST).length,
        inner_boost: statuses.filter((s) => status_type(s) === TYPE_INNER_BOOST).length,
        status_reply: statuses.filter((s) => s.mentions.length > 0).length,
        outer_reply: statuses.filter((s) => status_type(s) === TYPE_OUTER_REPLY).length,
        inner_reply: statuses.filter((s) => status_type(s) === TYPE_INNER_REPLY).length,
    }
    debug_log(statuses[0].account.id + " account statuses:", statistics);

    let sql = 'insert into statuses ( user, length, outer_boost, inner_boost, outer_reply, inner_reply ) values ( ?, ?, ?, ?, ?, ? )';
    db.insert(sql, [
        encode_md5(statuses[0].account.acct),
        statistics.status_length,
        statistics.outer_boost,
        statistics.inner_boost,
        statistics.outer_reply,
        statistics.inner_reply,
    ]);
}

function status_type(status) {
    let type;
    if (status.reblog) {
        type = status.reblog.account.acct.match(/@/)
            ? TYPE_OUTER_BOOST
            : TYPE_INNER_BOOST;
    }
    else if (status.mentions.length > 0) {
        type = (status.mentions.filter(a => a.acct.match(/@/)).length > 0)
            ? TYPE_OUTER_REPLY
            : TYPE_INNER_REPLY;
    }
    else {
        type = TYPE_STANDARD_TOOT;
    }
    return type;
}

function wait(msec) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), msec);
    })
}

function debug_log(msg) {
    if (process.env.NODE_DEBUG) {
        console.log(msg);
    }
}

async function main() {
    let response, max_id, following, target;

    for (let i = 0; i < 100; i++) {
        response = await get_public_timeline(max_id);
        for (let j in response.payload) {
            status = response.payload[j];
            max_id = status.id;
            target = await Promise.all([
                insert_user(status.account),
                get_account_following(status.account),
            ]);

            if (target[0] !== config.domain) continue;
            for (let k in target[1]) {
                await insert_user(target[1][k]);
            }
        }
    }
}

db.init();
main();
