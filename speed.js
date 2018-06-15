const request = require('request-promise');
const db = require('./lib/db');

async function get_instance_rank() {
    let url = 'http://distsn.org/cgi-bin/distsn-instance-speed-api.cgi';
    let options = {
        resolveWithFullResponse: true,
    };
    let resource;
    let instances;

    try {
        resource = await request(url, options);
        instances = JSON.parse(resource.body);
        await insert_instances(instances);
    }
    catch (e) {
        console.log("request error");
    }
}

async function insert_instances(instances) {
    let i = 0;
    if (!Array.isArray(instances)) return false;
    instances.forEach(async ins => {
        let sql = 'insert into instances ( domain, posts, title ) values( ?, ?, ? )';
        await db.insert(sql, [ ins.domain, ins.toots_per_week, ins.title ]);
        process.stdout.write('.');
        if (i++ % 20) process.stdout.write("\n");
    });
}

db.init2();
get_instance_rank();
