import fs from 'fs';
import {parseArgs} from 'node:util';
import marketer from './libs/marketer.js';

const opts = {
    sync: {type: 'boolean', default: false},
    syncall: {type: 'boolean', default: false},
    from: { type: 'string', short: 'f'},
    to: {type: 'string', short: 't'},
    filter: {type: 'string'},
    commodity: {type: 'string', short: 'd'},
    stock: {type: 'boolean', default: false},
    breakdown: {type: 'string', short: 'b'},
    bestbuy: {type: 'string'},
    bestsell: {type: 'string'},
    minmax: {type: 'boolean', default: false},
    shop: {type: 'string'},
    save: {type: 'boolean', default: false},
    nocfg: {type: 'boolean', default: false, short: "n"},
    help: {type: 'boolean', short: 'h', default: false},
    amount: { type: 'string', short: 'a'},
    margin: {type: 'string', short: 'm'},
    cost: {type: 'string', short: 'c'},
    profit: {type: 'string', short: 'p'}
}

const {values: pre_vals} = parseArgs({
    options: opts
});

let usercfg = {};
if(!pre_vals.nocfg && fs.existsSync("db/user.cfg")){
    usercfg = JSON.parse(fs.readFileSync("db/user.cfg", "utf-8"));
}

const cfg_opts = {
    amount: { type: 'string', short: 'a', default: usercfg.amount},
    margin: {type: 'string', short: 'm', default: usercfg.margin},
    cost: {type: 'string', short: 'c', default: usercfg.cost},
    profit: {type: 'string', short: 'p', default: usercfg.profit}
}

const {values} = parseArgs({
    options: {
        ...opts,
        ...cfg_opts
    }
});

if (!fs.existsSync("db")) {
  fs.mkdirSync("db", { recursive: true });
}   

const db = {
    terminals: fs.existsSync("db/terminals.json") ? JSON.parse(fs.readFileSync("db/terminals.json", 'utf8')) : {},
    commodities: fs.existsSync("db/commodities.json") ? JSON.parse(fs.readFileSync("db/commodities.json", 'utf8')) : {},
    prices: fs.existsSync("db/prices.json") ? JSON.parse(fs.readFileSync("db/prices.json", 'utf8')) : {},
    markets: fs.existsSync("db/markets.json") ? JSON.parse(fs.readFileSync("db/markets.json", 'utf8')) : {},
}

const writefn = (file, content) =>{
    fs.writeFileSync(`db/${file}`, content);
}

const printfn = (str)=>console.log(str);

marketer(values, writefn, printfn, db);