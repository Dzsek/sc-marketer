
import {mapTerminal, mapCommodity, mapPrice} from './mapper.js';
import {srch, formatUEC} from "./utils.js";

export default function (values, writeFunc, printFunc, data){
    let db = { ...data };

    if(values.save){
        const tosave = {
            amount: values.amount,
            profit: values.profit,
            margin: values.margin,
            cost: values.cost
        }

        writeFunc("user.json", tosave);
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
        printFunc(o);
        return;
    }

    if(values.sync || values.syncall){
        const execute = async() => {
            if(values.syncall){
                const r1 = await fetch("https://api.uexcorp.uk/2.0/terminals");
                const terminals = await r1.json();
                const termSave = terminals.data.map(x=>mapTerminal(x)).reduce((a,i)=>{a[i.id] = i; return a}, {});
                writeFunc("terminals.json", termSave);
                db.terminals = termSave;
                
                const r2 = await fetch("https://api.uexcorp.uk/2.0/commodities");
                const commodities = await r2.json();
                const comSave = commodities.data.map(x=>mapCommodity(x)).reduce((a,i)=>{a[i.id] = i; return a}, {});
                writeFunc("commodities.json", comSave);
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
            
            writeFunc("prices.json", priceSave);
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
            
            writeFunc("markets.json", markets);
            db.markets = markets;

        };
        
        execute();
        printFunc("Data synced");
    }

    if(values.help){
        printFunc(`
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
            printFunc("Shop not found");
            return;
        }

        printFunc(`${s.name}\t[${s.locator}]`);
        printFunc("-----Buys-----");
        s.buy.forEach(x=>printFunc(`[${x.amount}]\t\t${x.price}\t\t${x.name}`));
        printFunc("-----Sells-----");
        s.sell.forEach(x=>printFunc(`[${x.amount}]\t\t${x.price}\t\t${x.name}`));

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
        result.forEach(x=>printFunc(formatCom(x)));
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

            printFunc(`Selling ${commodities[0]?.name || values.bestbuy}`);
            printFunc("PRICE\t\tSTOCK\t\tLOCATION");
            printFunc("-----\t\t-----\t\t--------");
            commodities.forEach(x=>printFunc(formatCom(x)));
        }

        if(values.bestsell){
            const viableMarkets = market_array.filter(x=>x.buy.some(x=>srch(values.bestsell, x.name)));
            let commodities = viableMarkets.flatMap(x=>{
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

            printFunc(`Buying ${commodities[0]?.name || values.bestsell}`);
            printFunc("PRICE\t\tSTOCK\t\tLOCATION");
            printFunc("-----\t\t-----\t\t--------");
            commodities.forEach(x=>printFunc(formatCom(x)));
        }

        return;
    }

    if(values.from){
        const market_array = Object.values(db.markets);
        const source = market_array.find(x=> srch(values.from, x.name) || srch(values.from, x.locator));
        if(!source){
            printFunc("Source market does not exist");
            return;
        }

        let offers = [];
        if(values.to){
            const dest = market_array.find(x=> srch(values.to, x.name) || srch(values.to, x.locator));
            if(!dest){
                printFunc("Destination market does not exist");
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

        printFunc(`${source.name}\t\t\t[${source.locator.replaceAll('|', ' > ')}]`);
        printFunc("MRG\t[TCST + TPROF]\t\t[NAME @ PROFIT]\t\tBUY -> SELL\t\tSTK SRC -> DEST \t\t DESTINATION");
        printFunc("---\t--------------\t\t---------------\t\t-----------\t\t----------------\t\t------------");
        offers.forEach(x=>printFunc(formatter(x)));
        printFunc("---\t--------------\t\t---------------\t\t-----------\t\t----------------\t\t------------");
        printFunc("MRG\t[TCST + TPROF]\t\t[NAME @ PROFIT]\t\tBUY -> SELL\t\tSTK SRC -> DEST \t\t DESTINATION");

        return;
    }
}
