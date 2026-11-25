const fs = require('fs');
const {parseArgs} = require('node:util');
const {mapTerminal, mapCommodity, mapPrice}= require('./libs/mapper');

const srch = (clue, target)=> {
    const fragments = clue.split(',');
    if(fragments.length>1){
        for(const frag of fragments){
            if(!srch(frag, target)){
                return false;
            }
        }

        return true;
    }
    else
    {
        return target.toLowerCase().indexOf(clue.replaceAll('_',' ').toLowerCase()) >= 0;
    }
}

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

const formatUEC = x=> {
    if(x<5000) return x;
    if(x<5000000) return `${Math.floor(x/1000)}k`;
    return `${Math.floor(x/1000000)}m`;
};

const db = {
    terminals: fs.existsSync("db/terminals.json") ? JSON.parse(fs.readFileSync("db/terminals.json", 'utf8')) : {},
    commodities: fs.existsSync("db/commodities.json") ? JSON.parse(fs.readFileSync("db/commodities.json", 'utf8')) : {},
    prices: fs.existsSync("db/prices.json") ? JSON.parse(fs.readFileSync("db/prices.json", 'utf8')) : {},
    markets: fs.existsSync("db/markets.json") ? JSON.parse(fs.readFileSync("db/markets.json", 'utf8')) : {},
}

if(values.save){
    const tosave = {
        amount: values.amount,
        profit: values.profit,
        margin: values.margin,
        cost: values.cost
    }

    fs.writeFileSync("db/user.cfg", JSON.stringify(tosave, undefined, 2));
}

if(values.breakdown && values.amount){
    const sizes = [32, 24, 16, 8, 4, 2, 1];

    let maxcrate = Number(values.breakdown);
    let cargo = Number(values.amount);

    const crates = {};
    let si = sizes.indexOf(maxcrate); 
    while(cargo > 0){
        const sz = sizes[si];
        if(sz > cargo){
            si++;
            continue;
        }

        crates[sz] = (crates[sz] || 0) + 1;
        cargo -= sz;
    }   

    let o = "Crates: ";
    for(const cr in crates){
        o = `${o} [${crates[cr]} x ${cr}scu]`;
    }
    console.log(o);
    return;
}

if(values.sync || values.syncall){
    const execute = async() => {
        if(values.syncall){
            const r1 = await fetch("https://api.uexcorp.uk/2.0/terminals");
            const terminals = await r1.json();
            const termSave = terminals.data.map(x=>mapTerminal(x)).reduce((a,i)=>{a[i.id] = i; return a}, {});
            fs.writeFileSync("db/terminals.json", JSON.stringify(termSave, null, 2), 'utf8');
            db.terminals = termSave;
            
            const r2 = await fetch("https://api.uexcorp.uk/2.0/commodities");
            const commodities = await r2.json();
            const comSave = commodities.data.map(x=>mapCommodity(x)).reduce((a,i)=>{a[i.id] = i; return a}, {});
            fs.writeFileSync("db/commodities.json", JSON.stringify(comSave, null, 2), 'utf8');
            db.commodities = comSave;
        }

        const r3 = await fetch("https://api.uexcorp.uk/2.0/commodities_prices_all");
        const prices = await r3.json();
        const priceSave = prices.data.map(x=>mapPrice(x))
            .map(x=>({
                ...x,
                commodity: db.commodities[x.commodity].name,
                terminal: db.terminals[x.terminal].name,
                termid: x.terminal
            }));
        
        fs.writeFileSync("db/prices.json", JSON.stringify(priceSave, null, 2), 'utf8');
        db.prices = priceSave;

        const markets = {};
        db.prices.forEach(x=>{
            const market = markets[x.terminal] || 
            {
                name: x.terminal,
                locator: db.terminals[x.termid].locator,
                sell: [],
                buy: []
            };

            if(x.sells){
                market.sell.push({
                    name: x.commodity,
                    price: x.sellPrice,
                    amount: x.sellAmount,
                })
            }
            
            if(x.buys){
                market.buy.push({
                    name: x.commodity,
                    price: x.buyPrice,
                    amount: x.buyAmount
                })
            }

            markets[x.terminal] = market;
        });
        
        fs.writeFileSync("db/markets.json", JSON.stringify(markets, null, 2), 'utf8');
        db.markets = markets;
    };

    execute();
}

if(values.help){
    console.log(`
        --sync    //sync prices
        --syncall    //sync all data
        -f, --from <string>    //source market, required, best match
        -t, --to <number>    //destination market, best match
        --filter <string>    //filter by destination names
        -d, --commodity <string>    //filter by commodity names
        -a, --amount <number>    //scu to calculate profits and costs
        -m, --margin <number>    //1-99 minimum profit margin in percents
        -c, --cost <number>    //12345 or 12k, maximum uec willing to spend
        -p, --profit <number>    //12345 or 12k, minimum profit in uec
        --stock    //hide anything with 0 stock
        -b, --breakdown <number>    //breakdown scu into crate sizes, provide maximum crate size as number, use with --amount to specify total scu
        --bestbuy <string>    //cheapest commodity location, can use with --filter
        --bestsell <string>    //most expensive sell location, can use with --filter
        --minmax //get best profits for all commodities
        --shop <string> //list shop prices
        --save // saves --amount, --margin, --cost, --profit values as defaults
        -n, --nocfg //skip saved settings
        -h, --help    //this message
    `);
    return;
}

if(values.shop){
    const market_array = Object.values(db.markets);

    const s = market_array.find(x=>srch(values.shop, x.name) || srch(values.shop, x.locator));

    if(!s){
        console.log("Shop not found");
        return;
    }

    console.log(s.name);
    console.log("-----Buys-----");
    s.buy.forEach(x=>console.log(`[${x.amount}]\t\t${x.price}\t\t${x.name}`));
    console.log("-----Sells-----");
    s.sell.forEach(x=>console.log(`[${x.amount}]\t\t${x.price}\t\t${x.name}`));

    return;
}

if(values.minmax){
    const res = {};

    const market_array = Object.values(db.markets);
    for(const mk of market_array){
        for(const b of mk.buy){
            const cmdt = res[b.name] ?? { sellPrice: 0, buyPrice: 0 };
            res[b.name] = {
                ...cmdt,
                name: b.name,
                sellPrice: cmdt.sellPrice > b.price ? cmdt.sellPrice : b.price,
                sellLoc: cmdt.sellPrice > b.price ? cmdt.sellLoc : mk.name
            }
        }
        
        for(const b of mk.sell){
            const cmdt = res[b.name] ?? { sellPrice: 0, buyPrice: 0 };
            res[b.name] = {
                ...cmdt,
                name: b.name,
                buyPrice: cmdt.buyPrice > b.price ? cmdt.buyPrice : b.price,
                buyLoc: cmdt.buyPrice > b.price ? cmdt.buyLoc : mk.name
            }
        }
    }

    let result = Object.values(res);
    result = result.filter(x=>x.buyPrice > 0 && x.sellPrice > 0 && x.buyPrice < x.sellPrice);
    result = result.map(x=> ({...x, profit: x.sellPrice - x.buyPrice}));
    result = result.toSorted((a,b)=>a.profit-b.profit);

    const formatCom = (o)=> `${formatUEC(o.profit)}\t\t${o.name}\t\t${o.buyLoc}\t\t[${formatUEC(o.buyPrice)} -> ${formatUEC(o.sellPrice)}]\t\t${o.sellLoc}`;
    result.forEach(x=>console.log(formatCom(x)));
    return;
}

if(values.bestsell || values.bestbuy){
    const formatCom = (o)=> `${formatUEC(o.price)}\t\t[${o.amount}]\t\t${o.location}`;
    const market_array = Object.values(db.markets);

    if(values.bestbuy){
        const viableMarkets = market_array.filter(x=>x.sell.some(x=>srch(values.bestbuy, x.name)));
        let commodities = viableMarkets.flatMap(x=>{
            const coms = x.sell.find(y=>srch(values.bestbuy, y.name));
            return {
                name: coms.name, 
                price: coms.price,
                amount: coms.amount,
                location: x.name
            }
        }).toSorted((a,b)=>a.price-b.price);

        if(values.filter){
            commodities = commodities.filter(x=>srch(values.filter, x.location));
        }

        console.log(`Selling ${commodities[0]?.name || values.bestbuy}`);
        console.log("PRICE\t\tSTOCK\t\tLOCATION");
        console.log("-----\t\t-----\t\t--------");
        commodities.forEach(x=>console.log(formatCom(x)));
    }

    if(values.bestsell){
        const viableMarkets = market_array.filter(x=>x.buy.some(x=>srch(values.bestsell, x.name)));
        const commodities = viableMarkets.flatMap(x=>{
            const coms = x.buy.find(y=>srch(values.bestsell, y.name));
            return {
                name: coms.name, 
                price: coms.price,
                amount: coms.amount,
                location: x.name
            }
        }).toSorted((a,b)=>a.price-b.price);

        if(values.filter){
            commodities = commodities.filter(x=>srch(values.filter, x.location));
        }

        console.log(`Buying ${commodities[0]?.name || values.bestsell}`);
        console.log("PRICE\t\tSTOCK\t\tLOCATION");
        console.log("-----\t\t-----\t\t--------");
        commodities.forEach(x=>console.log(formatCom(x)));
    }

    return;
}

if(values.from){
    const market_array = Object.values(db.markets);
    const source = market_array.find(x=> srch(values.from, x.name) || srch(values.from, x.locator));
    if(!source){
        console.log("Source market does not exist");
        return;
    }

    let offers = [];
    if(values.to){
        const dest = market_array.find(x=> srch(values.to, x.name) || srch(values.to, x.locator));
        if(!dest){
            console.log("Destination market does not exist");
            return;
        }

        for(const com of source.sell){
            const b = dest.buy.find(x=>x.name===com.name && x.price > com.price);
            if(b){
                offers.push({
                    source: source.name,
                    destination: dest.name,
                    sLocator: source.locator,
                    dLocator: dest.locator,
                    name: com.name,
                    buyPrice: com.price,
                    sellPrice: b.price,
                    sourceStock: com.amount,
                    destStock: b.amount
                });
            }
        }
    }
    else{
        for(const com of source.sell){
            const viable_markets = market_array.filter(x=>x.buy.some(y=>y.name===com.name));
            for(const tgt of viable_markets){
                const b = tgt.buy.find(x=>x.name===com.name && x.price > com.price);
                if(b){
                    offers.push({
                        source: source.name,
                        destination: tgt.name,
                        sLocator: source.locator,
                        dLocator: tgt.locator,
                        name: com.name,
                        buyPrice: com.price,
                        sellPrice: b.price,
                        sourceStock: com.amount,
                        destStock: b.amount
                    });
                }
            }
        }
    }

    offers = offers.map(x=>{
        const profit = x.sellPrice - x.buyPrice;

        return {
            ...x,
            profit,
            margin: profit/x.buyPrice,
            cost: x.buyPrice,
            totalProfit: profit
        }
    });

    offers = offers.toSorted((a,b)=>a.margin-b.margin);

    if(values.amount){
        offers = offers.map(x=>({
            ...x,
            cost: x.buyPrice * Number(values.amount),
            totalProfit: x.profit * Number(values.amount)
        }));
    }

    if(values.margin){
        const mx = Number(values.margin);
        offers = offers.filter(x=>x.margin*100>=mx);
    }

    if(values.filter){
        offers = offers.filter(x=>srch(values.filter, x.destination) || srch(values.filter, x.dLocator));
    }

    if(values.cost){
        let cx = Number(values.cost.replaceAll('k', '000'))
        offers = offers.filter(x=>x.cost <= cx);
    }

    if(values.profit){
        let px = Number(values.profit.replaceAll('k', '000'))
        offers = offers.filter(x=>x.totalProfit >= px);
    }

    if(values.commodity){
        offers = offers.filter(x=>x.name.toLowerCase().indexOf(values.commodity.toLowerCase())>=0);
    }

    if(values.stock){
        offers = offers.filter(x=>x.sourceStock>0 && x.destStock>0);
    }

    const formatter = x => `${Math.round(x.margin*100)}%\t[${formatUEC(x.cost)} + ${formatUEC(x.totalProfit)}]\t\t[${x.name} @ ${x.profit}]\t\t${x.buyPrice} -> ${x.sellPrice}\t\t${x.sourceStock} -> ${x.destStock} \t\t ${x.destination}`;

    console.log(`${source.name}\t\t\t[${source.locator.replaceAll('|', ' > ')}]`);
    console.log("MRG\t[TCST + TPROF]\t\t[NAME @ PROFIT]\t\tBUY -> SELL\t\tSTK SRC -> DEST \t\t DESTINATION");
    console.log("---\t--------------\t\t---------------\t\t-----------\t\t----------------\t\t------------");
    offers.forEach(x=>console.log(formatter(x)));
    console.log("---\t--------------\t\t---------------\t\t-----------\t\t----------------\t\t------------");
    console.log("MRG\t[TCST + TPROF]\t\t[NAME @ PROFIT]\t\tBUY -> SELL\t\tSTK SRC -> DEST \t\t DESTINATION");

    return;
}