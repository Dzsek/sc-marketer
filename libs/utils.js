
export const srch = (clue, target)=> {
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

export const formatUEC = x=> {
    if(x<5000) return x;
    if(x<5000000) return `${Math.floor(x/1000)}k`;
    return `${Math.floor(x/1000000)}m`;
};