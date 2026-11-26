
import { useEffect, useRef, useState } from "react";
import marketer from "../../libs/marketer";
import styles from "./App.module.css";
import {parseArgsStringToArgv} from "string-argv";

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
    profit: {type: 'string', short: 'p'},
    clear: {type: 'boolean', default: false}
}

const parseInput = (input)=>{
  const args = parseArgsStringToArgv(input);
  const values = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      const o = args[i].replaceAll("-", "");
      const ov = (opts[o] && o) || Object.entries(opts).find(([k,v])=>v.short===o)?.[0];
      if(!ov) continue;

      if(opts[ov].type==="boolean"){
        values[ov] = true;
      }

      if(opts[ov].type==="string"){
        values[ov] = args[i + 1];
        i++;
      }
    }
  }

  return values;
}

const initText = `
  SC Market research tool.

  Uses the api from https://uexcorp.space/
  Pleas support UEXCORP as this wouldn't be possible without them.

  Run --syncall before starting

  --help to show a list of available commands;
`;

function App() {

  const [db,setDb] = useState(localStorage["db"] ? JSON.parse(localStorage.getItem("db")): {});
  const ref = useRef(null);
  const iref = useRef(null);
  const [output, setOutput] = useState(initText);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [histIndex, setHistIndex] = useState(-1);

  useEffect(()=>{
    if(ref.current){
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [output]);

  const execute = function(input){
    let options = parseInput(input);
    if(options.clear) return "clear";
    if(db.user){
      options = {...db.user, ...options};
    }
    let x = "";
    marketer(options, 
      (key, content)=>{
        const newdb = localStorage["db"] ? JSON.parse(localStorage.getItem("db")): {};
        newdb[key.replace(".json","")] = content;
        localStorage.setItem("db", JSON.stringify(newdb));
        setDb(newdb);
      }, 
      (s)=>{
        x = `${x}\n${s}`
      }, 
      db
    );
    return x;
  }

  return (
    <div className={styles.basePage}>
      <div ref={ref}>
        {output}
      </div>
      <input 
        ref={iref}
        placeholder="> Enter command"
        value={input}
        onChange={(e)=>setInput(e.target.value)}
        onKeyDown={(e)=>{
          if(e.key==="Enter"){
            const o = execute(input);

            if(o === "clear"){
              setOutput("");
            }
            else{ 
              setOutput((p)=>`${p}\n${o}`);
            }
            
            setHistory(p=>[...p, input]);
            setInput("");
            setHistIndex(-1);
          }
          if(e.key==="ArrowUp"){
            let i = histIndex;
            if(i===-1){
              i = history.length-1;
              setHistIndex(i);
            }
            else
            {
              i = Math.max(0,i-1);
              setHistIndex(i);
            }

            setInput(history[i]);
            e.preventDefault();
          }
          if(e.key==="ArrowDown"){
            let i = histIndex;
            if(i===-1){
              i = history.length-1;
              setHistIndex(i);
            }
            else
            {
              i = Math.min(history.length-1,i+1);
              setHistIndex(i);
            }
            
            setInput(history[i]);
          }
        }} 
      />
    </div>
  )
}

export default App
