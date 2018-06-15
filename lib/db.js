const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./db.sqlite3');

let actions = {};

actions.init = () => {
    db.serialize(function() {
        db.run('create table users (user text primary key, domain text, following integer, followed integer)');
        db.run('create table following (user text, following text, domain text)');
        db.run('create table statuses (user text, length integer, outer_boost integer, inner_boost integer, outer_reply integer, inner_reply integer)');
    });
};

actions.init2 = () => {
    db.serialize(function() {
        db.run('create table instances (domain text primary key, posts integer, title text)');
    });
};

actions.select = (sql, keys = []) => {
    return new Promise((resolve, reject) => {
        db.serialize(function() {
            db.get(sql, keys, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    });
};

actions.select_all = (sql, keys = []) => {
    return new Promise((resolve, reject) => {
        db.serialize(function() {
            db.all(sql, keys, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    });
};

actions.insert = (sql, keys = []) => {
    return new Promise((resolve, reject) => {
        db.serialize(function() {
            db.run(sql, keys, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    });
};

module.exports = actions;