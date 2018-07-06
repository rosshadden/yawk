import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
import * as koaBody from 'koa-bodyparser';

export enum Method {
	All = 'ALL',
	Del = 'DEL',
	Delete = 'DELETE',
	Get = 'GET',
	Patch = 'PATCH',
	Post = 'POST',
	Put = 'PUT',
}

export type Handler = (ctx: Koa.Context, next?: () => void) => any;
export type Registrar<T> = (registrar: T) => any;

export interface Route {
	path: string;
	method: Method;
	private?: boolean;
	description?: string;
	handler: Handler;
}

interface RouteOptions {
	private?: boolean;
	description?: string;
}

export interface YawkConfig {
	port: number;
}

export default class Yawk {
	app: Koa;
	router: KoaRouter;

	public routes: Array<Route>;

	constructor(private config: YawkConfig, ...registrars: Array<Registrar<Yawk>>) {
		this.app = new Koa();
		this.router = new KoaRouter({ prefix: '/api' });

		this.routes = [];

		this.init(registrars);
	}

	public register(
		path: Route | string,
		method: Method = Method.Get,
		handler: Handler = () => {},
		options: RouteOptions = {}
	) {
		let route: Route;

		if (typeof path === 'string') {
			route = {
				path,
				handler,
				method,
				private: options.private,
				description: options.description,
			};
		}

		handler = route.handler;
		method = route.method;
		path = route.path;

		this.routes.push(route);
		this.router[method.toLowerCase()](path, handler);
	}

	public start() {
		console.log('Listening on port:', this.config.port);
		this.app.listen(this.config.port);
	}

	private init(registrars: Array<Registrar<Yawk>>) {
		console.log('Initializing server...');
		this.app.use(koaBody());
		this.app.use((ctx, next) => {
			ctx.server = this;
			return next();
		});

		console.log('Initializing registrars...');
		for (const registrar of registrars) registrar(this);

		console.log('Initializing API...');
		this.app.use(this.router.routes());
		this.app.use(this.router.allowedMethods());
	}
}
