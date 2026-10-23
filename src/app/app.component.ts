import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Evento, Evidencia, Estadisticas, TrazaService, ViaPlaza } from './traza.service';

type Seccion='dashboard'|'incidencias'|'colas'|'historial'|'analisis'|'evidencias'|'vias';
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnDestroy {
  private api=inject(TrazaService);
  seccion:Seccion='dashboard';
  menuOpen=false;
  usuario=sessionStorage.getItem('traza_nombre')||'';
  rol=sessionStorage.getItem('traza_rol')||'';
  token=sessionStorage.getItem('traza_token')||'';
  loginUser='';loginPass='';loginLoading=false;
  cargando=false;guardando=false;error='';exito='';
  eventos:Evento[]=[];
  evidencias:Evidencia[]=[];
  stats:Estadisticas|null=null;
  plazas:{codigo:string;nombre:string}[]=[];
  viasDisponibles:ViaPlaza[]=[];
  cargandoVias=false;
  plazaGestion='P4';
  viasGestion:ViaPlaza[]=[];
  desdeVia:number|null=101;
  hastaVia:number|null=105;
  gestionandoVias=false;
  filtros={tipo:'',plaza:'',desde:'',hasta:''};
  fotos:Record<string,File|undefined>={};
  previsualizaciones:Record<string,string>={};
  urls:Record<string,string>={};
  form:Evento=this.nuevoFormulario('INCIDENCIA');
  readonly secciones:{key:Seccion;titulo:string;icono:string}[]=[
    {key:'dashboard',titulo:'Dashboard',icono:'◫'},
    {key:'incidencias',titulo:'Nueva incidencia',icono:'⚠'},
    {key:'colas',titulo:'Medición de colas',icono:'↗'},
    {key:'historial',titulo:'Historial',icono:'▤'},
    {key:'analisis',titulo:'Análisis',icono:'▥'},
    {key:'evidencias',titulo:'Evidencias',icono:'▧'},
    {key:'vias',titulo:'Vías por plaza',icono:'⚙'}
  ];
  readonly situaciones=['Fluida','Tráfico moderado','Congestionada','Tráfico en contra','Tráfico detenido','Otro'];
  readonly ingresos=['Con motorizado','Sin motorizado','Motorizado en camino','Ingreso restringido','Sin novedad'];
  readonly incidentes=['PNP en el semáforo','Falla en el sistema','Accidente vehicular','Vehículo averiado','Manifestación','Bloqueo de vía','Sin incidente','Otro'];
  readonly categorias=['PLAZA','INGRESO','INCIDENTE','COLA'];

  constructor(){if(this.token)this.inicializar();}
  get autenticado(){return !!this.token;}
  get supervisor(){return this.rol==='SUPERVISOR';}
  get titulo(){return this.secciones.find(s=>s.key===this.seccion)?.titulo||'TRAZA';}
  get maxDiario(){return Math.max(1,...(this.stats?.diario.map(d=>Number(d.total))||[]));}
  get maxPlaza(){return Math.max(1,...(this.stats?.plazas.map(d=>Number(d.total))||[]));}
  get mediaCola(){return Number(this.stats?.kpi.promedioCola||0);}
  get totalFotos(){return Object.values(this.fotos).filter(Boolean).length;}
  hoy(){
    const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  horaActual(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  nuevoFormulario(tipo:'INCIDENCIA'|'MEDICION'):Evento {
    return {tipo,plazaCodigo:'P1',turno:'A',via:'',fecha:this.hoy(),hora:this.horaActual(),
      situacion:'',ingreso:'',incidente:'',descripcion:'',colaMetros:null,estado:'REGISTRADO'};
  }
  async login(){
    if(!this.loginUser.trim()||!this.loginPass){this.error='Ingresa usuario y contraseña.';return;}
    this.loginLoading=true;this.error='';
    try{
      const data=await firstValueFrom(this.api.login(this.loginUser,this.loginPass));
      this.token=data.token;this.usuario=data.nombre;this.rol=data.rol;
      sessionStorage.setItem('traza_token',data.token);sessionStorage.setItem('traza_nombre',data.nombre);
      sessionStorage.setItem('traza_rol',data.rol);this.loginPass='';
      await this.inicializar();
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.loginLoading=false;}
  }
  logout(){sessionStorage.removeItem('traza_token');sessionStorage.removeItem('traza_nombre');sessionStorage.removeItem('traza_rol');
    this.limpiarFotos();
    this.token='';this.usuario='';this.rol='';this.eventos=[];this.evidencias=[];this.stats=null;this.error='';}
  async inicializar(){
    this.cargando=true;this.error='';
    try{
      const [catalogos,estadisticas,eventos]=await Promise.all([
        firstValueFrom(this.api.catalogos()),firstValueFrom(this.api.estadisticas()),firstValueFrom(this.api.listar())]);
      this.plazas=catalogos.plazas;this.stats=estadisticas;this.eventos=eventos;
      await this.cargarViasFormulario();
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.cargando=false;}
  }
  navegar(s:Seccion){
    this.seccion=s;this.menuOpen=false;this.error='';this.exito='';
    if(s==='incidencias'){this.form=this.nuevoFormulario('INCIDENCIA');this.limpiarFotos();this.cargarViasFormulario();}
    if(s==='colas'){this.form=this.nuevoFormulario('MEDICION');this.limpiarFotos();this.cargarViasFormulario();}
    if(s==='vias' && this.supervisor)this.cargarViasGestion();
    if(s==='historial')this.cargarEventos();
    if(s==='analisis'||s==='dashboard')this.cargarEstadisticas();
    if(s==='evidencias')this.cargarEvidencias();
  }
  cambiarPlazaRegistro(){
    this.form.via='';
    this.cargarViasFormulario();
  }
  async cargarViasFormulario(){
    const plaza=this.form.plazaCodigo;
    this.viasDisponibles=[];
    this.cargandoVias=true;
    try {
      const vias=await firstValueFrom(this.api.viasDePlaza(plaza));
      if(this.form.plazaCodigo===plaza)this.viasDisponibles=vias;
    } catch(e){
      if(this.form.plazaCodigo===plaza)this.error='No se pudieron consultar las vías de esta plaza.';
    } finally {
      if(this.form.plazaCodigo===plaza)this.cargandoVias=false;
    }
  }
  async cargarViasGestion(){
    if(!this.supervisor)return;
    const plaza=this.plazaGestion;
    this.gestionandoVias=true;
    try{
      const vias=await firstValueFrom(this.api.viasDePlaza(plaza));
      if(this.plazaGestion===plaza)this.viasGestion=vias;
    }catch(e){
      if(this.plazaGestion===plaza)this.error=this.errorHttp(e);
    }finally{if(this.plazaGestion===plaza)this.gestionandoVias=false;}
  }
  async asignarRangoVias(){
    if(!this.supervisor)return;
    const desde=Number(this.desdeVia),hasta=Number(this.hastaVia);
    if(!Number.isInteger(desde)||!Number.isInteger(hasta)||desde<1||hasta<desde||hasta>999999||hasta-desde>99){
      this.error='Indica un rango válido (máximo 100 vías por operación).';return;
    }
    this.gestionandoVias=true;this.error='';this.exito='';
    try {
      this.viasGestion=await firstValueFrom(this.api.asignarVias(this.plazaGestion,desde,hasta));
      this.exito='Vías '+desde+(desde===hasta?'':' a '+hasta)+' asignadas a '+this.plazaGestion+'.';
      if(this.form.plazaCodigo===this.plazaGestion)await this.cargarViasFormulario();
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.gestionandoVias=false;}
  }
  async quitarViaGestion(numero:string){
    if(!this.supervisor||!window.confirm('¿Desactivar la vía '+numero+' de '+this.plazaGestion+'? Los registros históricos se conservarán.'))return;
    this.gestionandoVias=true;this.error='';this.exito='';
    try {
      await firstValueFrom(this.api.desactivarVia(this.plazaGestion,numero));
      this.viasGestion=this.viasGestion.filter(v=>v.numero!==numero);
      this.exito='Vía '+numero+' desactivada en '+this.plazaGestion+'.';
      if(this.form.plazaCodigo===this.plazaGestion){
        if(this.form.via===numero)this.form.via='';
        await this.cargarViasFormulario();
      }
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.gestionandoVias=false;}
  }
  async cargarEventos(){
    this.cargando=true;this.error='';
    try{this.eventos=await firstValueFrom(this.api.listar(this.filtros));}
    catch(e){this.error=this.errorHttp(e);}finally{this.cargando=false;}
  }
  async cargarEstadisticas(){
    try{this.stats=await firstValueFrom(this.api.estadisticas());}
    catch(e){this.error=this.errorHttp(e);}
  }
  async cargarEvidencias(){
    this.cargando=true;this.error='';
    try{
      this.evidencias=await firstValueFrom(this.api.evidencias());
      for(const e of this.evidencias.slice(0,36))this.cargarImagen(e.id);
    }catch(e){this.error=this.errorHttp(e);}finally{this.cargando=false;}
  }
  cargarImagen(id:string){
    if(this.urls[id])return;
    this.api.foto(id).subscribe({next:b=>this.urls[id]=URL.createObjectURL(b),error:()=>{}});
  }
  seleccionarArchivo(event:Event,categoria:string){
    const input=event.target as HTMLInputElement;
    const file=input.files?.item(0);
    input.value='';
    if(file)this.agregarFoto(file,categoria);
  }
  pegarArchivo(event:ClipboardEvent,categoria:string){
    const items=Array.from(event.clipboardData?.items ?? []);
    const imagen=items.find(item=>item.kind==='file' && item.type.startsWith('image/'))?.getAsFile()
      ?? Array.from(event.clipboardData?.files ?? []).find(file=>file.type.startsWith('image/'));
    if(!imagen){
      this.error='No hay una imagen en el portapapeles. Copia una captura o fotografía y vuelve a intentarlo.';
      return;
    }
    event.preventDefault();
    const extension=imagen.type==='image/jpeg'?'jpg':imagen.type==='image/webp'?'webp':'png';
    const archivo=new File([imagen],categoria.toLowerCase()+'-pegada-'+Date.now()+'.'+extension,
      {type:imagen.type,lastModified:Date.now()});
    this.agregarFoto(archivo,categoria);
  }
  private agregarFoto(archivo:File,categoria:string){
    if(!['image/jpeg','image/png','image/webp'].includes(archivo.type)){
      this.error='Solo se permiten imágenes JPG, PNG o WebP.';
      return;
    }
    if(archivo.size===0||archivo.size>4000000){
      this.error='Cada fotografía debe pesar como máximo 4 MB.';
      return;
    }
    if(this.previsualizaciones[categoria])URL.revokeObjectURL(this.previsualizaciones[categoria]);
    this.fotos[categoria]=archivo;
    this.previsualizaciones[categoria]=URL.createObjectURL(archivo);
    this.error='';
    this.exito='';
  }
  quitarFoto(categoria:string){
    if(this.previsualizaciones[categoria])URL.revokeObjectURL(this.previsualizaciones[categoria]);
    delete this.previsualizaciones[categoria];
    delete this.fotos[categoria];
  }
  private limpiarFotos(){
    Object.values(this.previsualizaciones).forEach(url=>URL.revokeObjectURL(url));
    this.previsualizaciones={};
    this.fotos={};
  }
  reiniciarFormulario(){
    this.form=this.nuevoFormulario(this.form.tipo);
    this.limpiarFotos();
    this.cargarViasFormulario();
    this.error='';
  }
  async guardar(){
    if(!this.form.plazaCodigo||!this.form.fecha||!this.form.hora||!this.form.turno){
      this.error='Completa la plaza, turno, fecha y hora.';return;
    }
    if(this.form.tipo==='MEDICION'&&(this.form.colaMetros===null||this.form.colaMetros<0)){
      this.error='Indica el tamaño de cola en metros.';return;
    }
    this.guardando=true;this.error='';this.exito='';
    try{
      const result=await firstValueFrom(this.form.id?this.api.editar(this.form.id,this.form):this.api.crear(this.form));
      const fotos=Object.entries(this.fotos).filter(([,file])=>!!file);
      const fallidas:string[]=[];
      for(const [categoria,file] of fotos){
        try {
          await firstValueFrom(this.api.subir(result.id!,categoria,file!));
          // Evita volver a subir fotos que ya se guardaron correctamente.
          this.quitarFoto(categoria);
        } catch {
          fallidas.push(categoria);
        }
      }
      if(fallidas.length){
        // Conservar el registro y las fotografías fallidas para reintentar el envío.
        this.form={...result};
        this.error='Registro guardado, pero no se pudieron subir '+fallidas.length+
          ' fotografía(s). Conservamos las imágenes. Comprueba la configuración de Storage y pulsa Guardar cambios para reintentarlo.';
      } else {
        this.limpiarFotos();
        this.form=this.nuevoFormulario(result.tipo);
        this.cargarViasFormulario();
        this.exito='Registro y fotografías guardados correctamente.';
      }
      await Promise.all([this.cargarEstadisticas(),this.cargarEventos()]);
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.guardando=false;}
  }
  editar(e:Evento){
    this.form={...e};this.limpiarFotos();this.error='';this.exito='';
    this.seccion=e.tipo==='MEDICION'?'colas':'incidencias';this.menuOpen=false;
    this.cargarViasFormulario();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async eliminar(e:Evento){
    if(!e.id||!this.supervisor||!window.confirm('¿Eliminar definitivamente este registro y sus fotografías?'))return;
    try{await firstValueFrom(this.api.eliminar(e.id));this.exito='Registro eliminado.';await Promise.all([this.cargarEventos(),this.cargarEstadisticas()]);}
    catch(err){this.error=this.errorHttp(err);}
  }
  async eliminarFoto(e:Evidencia){
    if(!this.supervisor||!window.confirm('¿Eliminar esta evidencia?'))return;
    try{await firstValueFrom(this.api.quitarEvidencia(e.id));if(this.urls[e.id])URL.revokeObjectURL(this.urls[e.id]);delete this.urls[e.id];await this.cargarEvidencias();}
    catch(err){this.error=this.errorHttp(err);}
  }
  editarDesdeEvidencia(e:Evidencia){
    const encontrado=this.eventos.find(x=>x.id===e.eventoId);
    if(encontrado){this.editar(encontrado);return;}
    this.api.listar().subscribe({next:lista=>{
      const item=lista.find(x=>x.id===e.eventoId);
      if(item)this.editar(item);else this.error='No se encontró el registro asociado.';
    },error:err=>this.error=this.errorHttp(err)});
  }
  limpiarFiltros(){this.filtros={tipo:'',plaza:'',desde:'',hasta:''};this.cargarEventos();}
  exportar(formato:'json'|'csv'){
    const datos=this.eventos;
    if(!datos.length){this.error='No hay registros para exportar.';return;}
    let texto:string,mime:string,ext:string;
    if(formato==='json'){texto=JSON.stringify(datos,null,2);mime='application/json';ext='json';}
    else {
      const cols=['id','tipo','plazaCodigo','turno','via','fecha','hora','situacion','ingreso','incidente','colaMetros','estado','descripcion'];
      const esc=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
      texto='\ufeff'+cols.join(',')+'\n'+datos.map(e=>cols.map(c=>esc((e as unknown as Record<string,unknown>)[c])).join(',')).join('\n');
      mime='text/csv;charset=utf-8';ext='csv';
    }
    const url=URL.createObjectURL(new Blob([texto],{type:mime}));
    const a=document.createElement('a');a.href=url;a.download='TRAZA_'+this.hoy()+'.'+ext;a.click();URL.revokeObjectURL(url);
  }
  errorHttp(err:unknown){
    if(err instanceof HttpErrorResponse){
      if(err.status===0)return 'No se puede conectar con la API. Comprueba config.js y que Spring Boot esté activo.';
      if(err.status===401)return 'Sesión vencida o credenciales incorrectas. Inicia sesión otra vez.';
      if(err.status===403)return 'Tu rol no permite realizar esta acción.';
      return String(err.error?.detail||err.error?.message||('Error del servidor ('+err.status+')'));
    }
    return 'Ocurrió un error inesperado.';
  }
  ngOnDestroy(){this.limpiarFotos();Object.values(this.urls).forEach(u=>URL.revokeObjectURL(u));}
}
