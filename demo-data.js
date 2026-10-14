/* Smashiza — datos de MODO PRUEBA (menú real, gente y órdenes inventadas) */
'use strict';

function buildSmashizaDemo(){
  const menu=[
    {Id:'s6',Categoria:'smash',Emoji:'🍔',Nombre:'Tocho',Precio:199,Orden:0},
    {Id:'barbie',Categoria:'smash',Emoji:'🍖',Nombre:'La Barbie',Precio:179,Orden:1},
    {Id:'s3',Categoria:'smash',Emoji:'🥓',Nombre:'La de Cajon',Precio:179,Orden:2},
    {Id:'s1',Categoria:'smash',Emoji:'🥓',Nombre:'La Master',Precio:179,Orden:3},
    {Id:'s2',Categoria:'smash',Emoji:'🌶',Nombre:'El Santos',Precio:179,Orden:4},
    {Id:'e2',Categoria:'especial',Emoji:'🍟',Nombre:'Papas Fritas Onduladas',Precio:89,Orden:0},
    {Id:'pgajo',Categoria:'especial',Emoji:'🍟',Nombre:'Papas Gajo',Precio:89,Orden:1},
    {Id:'pwaf',Categoria:'especial',Emoji:'🍟',Nombre:'Papas Waffle',Precio:89,Orden:2},
    {Id:'aros',Categoria:'especial',Emoji:'🧅',Nombre:'Aros de cebolla',Precio:99,Orden:3},
    {Id:'dedos',Categoria:'especial',Emoji:'🧀',Nombre:'Dedos de queso',Precio:99,Orden:4},
    {Id:'band',Categoria:'especial',Emoji:'🌭',Nombre:'Banderillas',Precio:69,Orden:5},
    {Id:'tend',Categoria:'especial',Emoji:'🐔',Nombre:'Tenders de pollo',Precio:169,Orden:6},
    {Id:'xcar',Categoria:'extras',Emoji:'🥩',Nombre:'Carne',Precio:20,Orden:0},
    {Id:'xq',Categoria:'extras',Emoji:'🧀',Nombre:'Queso americano',Precio:15,Orden:1},
    {Id:'x1',Categoria:'extras',Emoji:'🥫',Nombre:'Aderezo Especial',Precio:15,Orden:2},
    {Id:'x2',Categoria:'extras',Emoji:'🌶️',Nombre:'Aderezo Jalapeño',Precio:15,Orden:3},
    {Id:'xbbq',Categoria:'extras',Emoji:'🍖',Nombre:'Aderezo BBQ',Precio:15,Orden:4},
    {Id:'x3',Categoria:'extras',Emoji:'🥫',Nombre:'Aderezo catsup',Precio:15,Orden:5},
    {Id:'x7',Categoria:'extras',Emoji:'🥗',Nombre:'Aderezo Ranch',Precio:15,Orden:6},
    {Id:'x5',Categoria:'extras',Emoji:'🥒',Nombre:'Pepinillos',Precio:15,Orden:7},
    {Id:'x4',Categoria:'extras',Emoji:'🌶️',Nombre:'Chile en rajas',Precio:15,Orden:8},
    {Id:'xjal',Categoria:'extras',Emoji:'🌶️',Nombre:'Jalapeños con cebolla guisada',Precio:15,Orden:9},
    {Id:'x6',Categoria:'extras',Emoji:'🍍',Nombre:'Piña',Precio:15,Orden:10},
    {Id:'xjam',Categoria:'extras',Emoji:'🍖',Nombre:'Jamon',Precio:15,Orden:11},
    {Id:'x8',Categoria:'extras',Emoji:'🥓',Nombre:'Tocino',Precio:15,Orden:12},
    {Id:'xmerm',Categoria:'extras',Emoji:'🥓',Nombre:'Mermelada de tocino',Precio:15,Orden:13},
    {Id:'xcg',Categoria:'extras',Emoji:'🧅',Nombre:'Cebolla guisada',Precio:15,Orden:14},
    {Id:'xcc',Categoria:'extras',Emoji:'🧅',Nombre:'Cebolla cruda',Precio:15,Orden:15},
    {Id:'xcrisp',Categoria:'extras',Emoji:'🧅',Nombre:'Cebolla caramelizada crispy',Precio:15,Orden:16},
    {Id:'xpw',Categoria:'extras',Emoji:'🍟',Nombre:'Papas Waffle',Precio:20,Orden:17},
    {Id:'xpg',Categoria:'extras',Emoji:'🍟',Nombre:'Papas Gajo',Precio:20,Orden:18},
    {Id:'xqp',Categoria:'extras',Emoji:'🧀',Nombre:'Queso para papas',Precio:15,Orden:19},
    {Id:'b1',Categoria:'bebidas',Emoji:'🧃',Nombre:'Boing',Precio:25,Orden:0},
    {Id:'b2',Categoria:'bebidas',Emoji:'🥤',Nombre:'Jarrito',Precio:25,Orden:1},
    {Id:'p1',Categoria:'postres',Emoji:'🍦',Nombre:'Chasca M',Precio:55,Orden:0},
    {Id:'p2',Categoria:'postres',Emoji:'🍦',Nombre:'Chasca G',Precio:60,Orden:1},
    {Id:'p3',Categoria:'postres',Emoji:'🍦',Nombre:'Chasca 1/2L',Precio:130,Orden:2},
    {Id:'p4',Categoria:'postres',Emoji:'🍪',Nombre:'Galleta Costco',Precio:15,Orden:3},
    {Id:'j1',Categoria:'jochos',Emoji:'🌭',Nombre:'Sencillito',Precio:99,Orden:0},
    {Id:'j2',Categoria:'jochos',Emoji:'🌭',Nombre:'Masterizado',Precio:99,Orden:1},
    {Id:'j3',Categoria:'jochos',Emoji:'🌭',Nombre:'De Todillo',Precio:99,Orden:2},
    {Id:'j4',Categoria:'jochos',Emoji:'🌭',Nombre:'El Ken',Precio:99,Orden:3},
    {Id:'j5',Categoria:'jochos',Emoji:'🍔',Nombre:'PROMO PAR DE JOCHOS',Precio:199,Orden:4},
  ];
  const cats=[
    {Id:'smash',Etiqueta:'SMASH BURGERS'},
    {Id:'especial',Etiqueta:'PAPAS'},
    {Id:'extras',Etiqueta:'EXTRAS & COMPLEMENTOS'},
    {Id:'bebidas',Etiqueta:'BEBIDAS'},
    {Id:'postres',Etiqueta:'POSTRES'},
    {Id:'jochos',Etiqueta:'JOCHOS'},
  ];
  const inventory=[
    {Nombre:'Carne',Unidad:'g',Stock:9000,Minimo:1500,Ideal:9000},
    {Nombre:'Dedos de queso',Unidad:'g',Stock:2260,Minimo:1000,Ideal:2260},
    {Nombre:'Banderillas',Unidad:'pza',Stock:28,Minimo:6,Ideal:28},
    {Nombre:'Papas Onduladas',Unidad:'g',Stock:4000,Minimo:2500,Ideal:4000},
    {Nombre:'Papas Francesas',Unidad:'g',Stock:2260,Minimo:1000,Ideal:2260},
    {Nombre:'Papas gajo',Unidad:'g',Stock:3000,Minimo:1000,Ideal:3000},
    {Nombre:'Papas waffle',Unidad:'g',Stock:3000,Minimo:800,Ideal:3000},
    {Nombre:'Pan',Unidad:'pza',Stock:48,Minimo:8,Ideal:40},
    {Nombre:'Tocino',Unidad:'g',Stock:1000,Minimo:500,Ideal:1000},
    {Nombre:'Piña',Unidad:'pza',Stock:16,Minimo:8,Ideal:16},
    {Nombre:'Queso manchego',Unidad:'g',Stock:400,Minimo:200,Ideal:400},
    {Nombre:'Tocino en trozos',Unidad:'g',Stock:567,Minimo:250,Ideal:567},
    {Nombre:'Mayonesa',Unidad:'g',Stock:1000,Minimo:500,Ideal:1000},
    {Nombre:'Ranch',Unidad:'g',Stock:2000,Minimo:500,Ideal:2000},
    {Nombre:'BBQ',Unidad:'g',Stock:2000,Minimo:500,Ideal:2000},
    {Nombre:'Catsup',Unidad:'g',Stock:1300,Minimo:500,Ideal:1300},
    {Nombre:'Sriracha',Unidad:'g',Stock:500,Minimo:200,Ideal:500},
    {Nombre:'Catsup Imitacion',Unidad:'g',Stock:3000,Minimo:1500,Ideal:3000},
    {Nombre:'Aros de cebolla',Unidad:'g',Stock:1000,Minimo:500,Ideal:1000},
    {Nombre:'Cebolla Crispy',Unidad:'g',Stock:1360,Minimo:100,Ideal:1360},
    {Nombre:'Bolsa Chica Kraft',Unidad:'pza',Stock:60,Minimo:20,Ideal:60},
    {Nombre:'Bolsa Grande Kraft',Unidad:'pza',Stock:30,Minimo:15,Ideal:30},
    {Nombre:'Empaques Medianos',Unidad:'pza',Stock:20,Minimo:10,Ideal:20},
    {Nombre:'Empaque Grande',Unidad:'pza',Stock:15,Minimo:10,Ideal:15},
    {Nombre:'Mostaza',Unidad:'g',Stock:1000,Minimo:500,Ideal:1000},
    {Nombre:'Empaque Papas',Unidad:'pza',Stock:18,Minimo:20,Ideal:100},
    {Nombre:'Empaque 2oz',Unidad:'pza',Stock:200,Minimo:20,Ideal:200},
    {Nombre:'Chiles Jalapeños',Unidad:'g',Stock:380,Minimo:400,Ideal:1400},
    {Nombre:'Queso Americano',Unidad:'pza',Stock:144,Minimo:26,Ideal:144},
    {Nombre:'Jamon',Unidad:'g',Stock:400,Minimo:100,Ideal:400},
    {Nombre:'Pepinillos',Unidad:'pza',Stock:40,Minimo:10,Ideal:40},
    {Nombre:'Pan jochos',Unidad:'pza',Stock:30,Minimo:8,Ideal:30},
    {Nombre:'Salchicha',Unidad:'pza',Stock:40,Minimo:10,Ideal:40},
    {Nombre:'Pollo',Unidad:'g',Stock:2500,Minimo:600,Ideal:2500},
    {Nombre:'Helado',Unidad:'g',Stock:2000,Minimo:400,Ideal:2000},
    {Nombre:'Galleta',Unidad:'pza',Stock:24,Minimo:6,Ideal:24},
  ].map(r=>({Proveedor:'',Nota:'',...r}));

  const rec= (p,i,c,u)=>({Producto:p,Ingrediente:i,Cantidad:c,Unidad:u});
  const smashBase=(name, extra)=>[
    rec(name,'Pan',1,'pza'), rec(name,'Carne',150,'g'), rec(name,'Papas Onduladas',150,'g'),
    rec(name,'Queso Americano',2,'pza'), rec(name,'Catsup Imitacion',20,'g'),
    rec(name,'Bolsa Chica Kraft',1,'pza'), rec(name,'Empaque Papas',1,'pza'), rec(name,'Empaque 2oz',2,'pza'),
    ...extra
  ];
  const recipes=[
    rec('Papas Fritas Onduladas','Papas Onduladas',150,'g'), rec('Papas Fritas Onduladas','Empaque Grande',1,'pza'),
    rec('Papas Gajo','Papas gajo',180,'g'), rec('Papas Gajo','Empaque Papas',1,'pza'),
    rec('Papas Waffle','Papas waffle',180,'g'), rec('Papas Waffle','Empaque Papas',1,'pza'),
    rec('Aros de cebolla','Aros de cebolla',120,'g'), rec('Aros de cebolla','Empaque Papas',1,'pza'),
    rec('Dedos de queso','Dedos de queso',150,'g'), rec('Dedos de queso','Empaque Papas',1,'pza'),
    rec('Banderillas','Banderillas',2,'pza'), rec('Banderillas','Empaques Medianos',1,'pza'),
    rec('Tenders de pollo','Pollo',180,'g'), rec('Tenders de pollo','Empaque Grande',1,'pza'),
    ...smashBase('La Barbie',[rec('La Barbie','BBQ',25,'g'),rec('La Barbie','Aros de cebolla',30,'g'),rec('La Barbie','Cebolla Crispy',20,'g'),rec('La Barbie','Chiles Jalapeños',20,'g')]),
    ...smashBase('La de Cajon',[rec('La de Cajon','Tocino',20,'g'),rec('La de Cajon','Chiles Jalapeños',20,'g')]),
    ...smashBase('La Master',[rec('La Master','Ranch',20,'g'),rec('La Master','Tocino en trozos',20,'g'),rec('La Master','Chiles Jalapeños',20,'g')]),
    ...smashBase('El Santos',[rec('El Santos','Ranch',20,'g'),rec('El Santos','Chiles Jalapeños',20,'g')]),
    ...smashBase('Tocho',[rec('Tocho','Tocino',20,'g'),rec('Tocho','Piña',1,'pza'),rec('Tocho','Tocino en trozos',20,'g'),rec('Tocho','Ranch',40,'g'),rec('Tocho','Chiles Jalapeños',20,'g')]),
    rec('Carne','Carne',50,'g'), rec('Queso americano','Queso Americano',1,'pza'),
    rec('Aderezo Especial','Mayonesa',25,'g'), rec('Aderezo Jalapeño','Sriracha',20,'g'),
    rec('Aderezo BBQ','BBQ',25,'g'), rec('Aderezo catsup','Catsup',25,'g'), rec('Aderezo Ranch','Ranch',25,'g'),
    rec('Pepinillos','Pepinillos',4,'pza'), rec('Chile en rajas','Chiles Jalapeños',20,'g'),
    rec('Jalapeños con cebolla guisada','Chiles Jalapeños',15,'g'), rec('Piña','Piña',1,'pza'),
    rec('Jamon','Jamon',20,'g'), rec('Tocino','Tocino',20,'g'), rec('Mermelada de tocino','Tocino en trozos',10,'g'),
    rec('Cebolla caramelizada crispy','Cebolla Crispy',15,'g'), rec('Queso para papas','Queso manchego',20,'g'),
    rec('Papas Waffle','Papas waffle',80,'g'), rec('Papas Gajo','Papas gajo',80,'g'),
    rec('Boing','Bolsa Chica Kraft',1,'pza'), rec('Jarrito','Bolsa Chica Kraft',1,'pza'),
    rec('Chasca M','Helado',80,'g'), rec('Chasca G','Helado',120,'g'), rec('Chasca 1/2L','Helado',250,'g'),
    rec('Galleta Costco','Galleta',1,'pza'),
    rec('Sencillito','Pan jochos',1,'pza'), rec('Sencillito','Salchicha',1,'pza'), rec('Sencillito','Mostaza',10,'g'),
    rec('Masterizado','Pan jochos',1,'pza'), rec('Masterizado','Salchicha',1,'pza'), rec('Masterizado','Tocino',15,'g'), rec('Masterizado','Queso Americano',1,'pza'),
    rec('De Todillo','Pan jochos',1,'pza'), rec('De Todillo','Salchicha',1,'pza'), rec('De Todillo','Jamon',15,'g'), rec('De Todillo','Piña',1,'pza'),
    rec('El Ken','Pan jochos',1,'pza'), rec('El Ken','Salchicha',1,'pza'), rec('El Ken','Cebolla Crispy',15,'g'), rec('El Ken','BBQ',15,'g'),
    rec('PROMO PAR DE JOCHOS','Pan jochos',2,'pza'), rec('PROMO PAR DE JOCHOS','Salchicha',2,'pza'), rec('PROMO PAR DE JOCHOS','Bolsa Grande Kraft',1,'pza'),
  ];

  const costs=[
    {Producto:'Tocho',Costo:67.03},{Producto:'La Master',Costo:53.71},{Producto:'La Barbie',Costo:55},
    {Producto:'La de Cajon',Costo:58.02},{Producto:'El Santos',Costo:53.22},{Producto:'Papas Fritas Onduladas',Costo:25},
    {Producto:'Papas Gajo',Costo:25},{Producto:'Papas Waffle',Costo:33},{Producto:'Aros de cebolla',Costo:29},
    {Producto:'Dedos de queso',Costo:30},{Producto:'Banderillas',Costo:24},{Producto:'Tenders de pollo',Costo:71},
    {Producto:'Chile en rajas',Costo:0.96},{Producto:'Jalapeños con cebolla guisada',Costo:0.5},{Producto:'Piña',Costo:5.87},
    {Producto:'Jamon',Costo:2.94},{Producto:'Tocino',Costo:5},{Producto:'Mermelada de tocino',Costo:0.73},
    {Producto:'Cebolla guisada',Costo:0.25},{Producto:'Cebolla cruda',Costo:0.13},{Producto:'Boing',Costo:12.49},
    {Producto:'Jarrito',Costo:12.49},{Producto:'Cebolla caramelizada crispy',Costo:4},{Producto:'Queso para papas',Costo:5},
    {Producto:'Chasca M',Costo:16},{Producto:'Chasca G',Costo:20},{Producto:'Chasca 1/2L',Costo:30},{Producto:'Galleta Costco',Costo:7.5},
    {Producto:'Sencillito',Costo:37},{Producto:'Masterizado',Costo:41},{Producto:'De Todillo',Costo:41},{Producto:'El Ken',Costo:41},
    {Producto:'PROMO PAR DE JOCHOS',Costo:70},{Producto:'Carne',Costo:8},{Producto:'Queso americano',Costo:4},
    {Producto:'Aderezo Especial',Costo:2},{Producto:'Aderezo Jalapeño',Costo:2},{Producto:'Aderezo BBQ',Costo:2},
    {Producto:'Aderezo catsup',Costo:1.5},{Producto:'Aderezo Ranch',Costo:2},{Producto:'Pepinillos',Costo:1.2},
  ];
  const catalog=menu.map(m=>({Producto:m.Nombre,Emoji:m.Emoji,Categoria:m.Categoria,EnMenu:'si'}));
  const priceHist=menu.map(m=>({Producto:m.Nombre,Desde:'2026-01-01',Precio:m.Precio}));

  const clients=[
    ['Mariana Soto','Coto 2 casa 8'],['Luis Herrera','Coto 5 casa 21'],['Paola Méndez','Coto 8 casa 12'],
    ['Diego Rivas','Av. Patria 340'],['Sofía Navarro','Coto 3 casa 4'],['Andrés Vega','Coto 11 casa 19'],
    ['Valeria Cruz','Coto 1 casa 7'],['Jorge Salinas','Coto 9 casa 2'],['Camila Ortiz','Coto 6 casa 15'],
    ['Ricardo Peña','Coto 4 casa 30'],['Fernanda Gil','Coto 7 casa 11'],['Héctor Lozano','Coto 10 casa 5'],
  ];
  const comments=['','Sin cebolla','Extra salsa','Sin picante','Bien cocida','Sin pepinillo','','Tocar interfón'];
  const pays=['Efectivo','Efectivo','Efectivo','Transferencia','Transferencia','Tarjeta'];
  const combos=[
    [['La Master',1],['Papas Fritas Onduladas',1],['Boing',1]],
    [['El Santos',1],['Jarrito',1]],
    [['La Barbie',1],['Aros de cebolla',1]],
    [['Tocho',1],['Papas Gajo',1],['Boing',1]],
    [['La de Cajon',2]],
    [['Sencillito',1],['Papas Fritas Onduladas',1],['Jarrito',1]],
    [['Masterizado',1],['Boing',1]],
    [['PROMO PAR DE JOCHOS',1],['Papas Waffle',1]],
    [['Tenders de pollo',1],['Aderezo Ranch',1]],
    [['La Master',1],['Tocino',1],['Boing',1]],
    [['El Ken',1],['Dedos de queso',1]],
    [['Chasca G',1],['Galleta Costco',2]],
    [['La Barbie',1],['La Master',1],['Papas Fritas Onduladas',1]],
    [['De Todillo',1],['Jarrito',2]],
    [['Papas Gajo',1],['Queso para papas',1],['Boing',1]],
  ];
  const price=Object.fromEntries(menu.map(m=>[m.Nombre,m.Precio]));
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const orders=[];
  const movements=[];
  const invMap={};
  inventory.forEach(i=>invMap[i.Nombre]={...i, Stock:Number(i.Stock)});
  const recipeByProd={};
  recipes.forEach(r=>{
    if(!recipeByProd[r.Producto]) recipeByProd[r.Producto]=[];
    recipeByProd[r.Producto].push(r);
  });

  let num=1;
  const today=new Date(); today.setHours(12,0,0,0);
  for(let day=13; day>=0; day--){
    const d=new Date(today); d.setDate(today.getDate()-day);
    const weekend=d.getDay()===0||d.getDay()===6;
    const isToday=day===0;
    const count=isToday?9:(weekend?14:10);
    for(let i=0;i<count;i++){
      const hour=[12,13,13,14,19,20,20,21,21,22][i%10];
      const min=(i*11+day*3)%60;
      const cli=clients[(num+i+day)%clients.length];
      const combo=combos[(num+day)%combos.length];
      const pay=pays[(num+i)%pays.length];
      let estado='Entregada';
      if(isToday){
        if(i<3) estado='Pendiente';
        else if(i<5) estado='Preparando';
        else if(i===8) estado='Cancelada';
      } else if(i===0 && day%4===0) estado='Cancelada';
      const prods=combo.map(x=>x[0]).join(' | ');
      const qtys=combo.map(x=>x[1]+'x').join(' | ');
      const sub=combo.reduce((s,[name,qty])=>s+(price[name]||0)*qty,0);
      const ajuste=(num%17===0)?-20:0;
      const total=Math.max(0,Math.round(sub+ajuste));
      let recibido='', cambio='';
      if(pay==='Efectivo' && estado!=='Cancelada'){
        recibido=total<=200?200:(total<=500?500:total);
        cambio=recibido-total;
      }
      orders.push({
        Num_Orden:num, Fecha:ymd(d), Hora:`${pad(hour)}:${pad(min)}:00`,
        Cliente:cli[0], Direccion:cli[1], Productos:prods, Cantidades:qtys,
        Comentarios:comments[(num+i)%comments.length], Metodo_Pago:pay,
        Ajuste:ajuste||'', Total:total, Recibido:recibido, Cambio:cambio, Estado:estado
      });
      if(estado==='Entregada'){
        combo.forEach(([name,qty])=>{
          (recipeByProd[name]||[]).forEach(r=>{
            const item=invMap[r.Ingrediente];
            const use=(Number(r.Cantidad)||0)*qty;
            if(item) item.Stock=Math.round((item.Stock-use)*1000)/1000;
            movements.push({
              Fecha:ymd(d), Hora:`${pad(hour)}:${pad(min)}:10`, Tipo:'venta',
              Ingrediente:r.Ingrediente, Cantidad:-use, Unidad:r.Unidad,
              Num_Orden:num, Nota:'Entrega'
            });
          });
        });
      }
      num++;
    }
  }
  const inventoryOut=inventory.map(i=>{
    const live=invMap[i.Nombre];
    return {...i, Stock:live?live.Stock:i.Stock};
  });

  return { menu, cats, inventory:inventoryOut, recipes, costs, catalog, priceHist, orders, movements };
}
