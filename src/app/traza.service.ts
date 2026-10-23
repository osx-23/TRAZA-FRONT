import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Observable } from 'rxjs';

declare global { interface Window { __TRAZA_API_URL__?: string; } }
export const API = (typeof window !== 'undefined' && window.__TRAZA_API_URL__) || 'http://localhost:8080/api';

export interface ViaPlaza { numero:string; }
export interface Evento {
  id?: string;
  tipo: 'INCIDENCIA'|'MEDICION';
  plazaCodigo: string;
  turno: string;
  via: string;
  fecha: string;
  hora: string;
  situacion: string;
  ingreso: string;
  incidente: string;
  descripcion: string;
  colaMetros: number|null;
  estado: string;
  creadoEn?: string;
  creadoPor?: string;
}
export interface Evidencia {
  id: string;
  eventoId: string;
  categoria: string;
  nombre: string;
  mime: string;
  tamano: number;
  plaza: string;
  fecha: string;
}
export interface Estadisticas {
  kpi: {incidencias:number; mediciones:number; maxCola:number; promedioCola:number; total:number};
  diario: {fecha:string;total:number;maxCola:number}[];
  plazas: {plaza:string;total:number;incidencias:number;maxCola:number}[];
  recientes: Evento[];
}
export const authInterceptor: HttpInterceptorFn = (req,next) => {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('traza_token') : null;
  if (token && req.url.startsWith(API+'/') && !req.url.endsWith('/auth/login')) {
    req = req.clone({setHeaders:{Authorization:'Bearer '+token}});
  }
  return next(req);
};

@Injectable({providedIn:'root'})
export class TrazaService {
  private http = inject(HttpClient);
  login(username:string,password:string):Observable<{token:string;nombre:string;rol:string;expiresIn:number}>{
    return this.http.post<{token:string;nombre:string;rol:string;expiresIn:number}>(API+'/auth/login',{username,password});
  }
  catalogos():Observable<{plazas:{codigo:string;nombre:string}[];turnos:string[]}>{
    return this.http.get<{plazas:{codigo:string;nombre:string}[];turnos:string[]}>(API+'/catalogos');
  }
  viasDePlaza(plaza:string):Observable<ViaPlaza[]>{
    return this.http.get<ViaPlaza[]>(API+'/plazas/'+encodeURIComponent(plaza)+'/vias');
  }
  asignarVias(plaza:string,desde:number,hasta:number):Observable<ViaPlaza[]>{
    return this.http.post<ViaPlaza[]>(API+'/plazas/'+encodeURIComponent(plaza)+'/vias',{desde,hasta});
  }
  desactivarVia(plaza:string,numero:string):Observable<void>{
    return this.http.delete<void>(API+'/plazas/'+encodeURIComponent(plaza)+'/vias/'+encodeURIComponent(numero));
  }
  listar(filtros:Record<string,string>={}):Observable<Evento[]>{
    const params = new URLSearchParams(Object.entries(filtros).filter(([,v])=>!!v));
    return this.http.get<Evento[]>(API+'/eventos'+(params.size?'?'+params.toString():''));
  }
  crear(e:Evento):Observable<Evento>{return this.http.post<Evento>(API+'/eventos',e);}
  editar(id:string,e:Evento):Observable<Evento>{return this.http.put<Evento>(API+'/eventos/'+id,e);}
  eliminar(id:string):Observable<void>{return this.http.delete<void>(API+'/eventos/'+id);}
  estadisticas():Observable<Estadisticas>{return this.http.get<Estadisticas>(API+'/estadisticas');}
  evidencias(eventoId?:string):Observable<Evidencia[]>{
    return this.http.get<Evidencia[]>(API+'/evidencias'+(eventoId?'?eventoId='+encodeURIComponent(eventoId):''));
  }
  foto(id:string):Observable<Blob>{return this.http.get(API+'/evidencias/'+id+'/archivo',{responseType:'blob'});}
  subir(id:string,categoria:string,archivo:File):Observable<unknown>{
    const body=new FormData();body.append('categoria',categoria);body.append('archivo',archivo);
    return this.http.post(API+'/eventos/'+id+'/evidencias',body);
  }
  quitarEvidencia(id:string):Observable<void>{return this.http.delete<void>(API+'/evidencias/'+id);}
}
