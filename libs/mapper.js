const on = (s) => s ?? "";

export const mapTerminal = (input)=>({
    id: input.id,
    name: input.fullname,
    locator: `${on(input.star_system_name)}|${on(input.planet_name)}|${on(input.orbit_name)}|${on(input.moon_name)}|${on(input.space_station_name)}|${on(input.outpost_name)}|${on(input.city_name)}`
});

export const mapCommodity = (input)=>({
    id: input.id,
    name: input.name
});

export const mapPrice = (input)=>({
    id: input.id,
    commodity: input.id_commodity,
    terminal: input.id_terminal,
    buys: input.price_sell>0,
    sells: input.price_buy>0,
    buyAmount: input.scu_sell,
    sellAmount: input.scu_buy,
    buyPrice: input.price_sell,
    sellPrice: input.price_buy
});