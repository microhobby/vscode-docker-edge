import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
/* node default */
const netList = require('network-list');
const SSH = require('simple-ssh');


export class TorizonDeviceProvider 
	implements vscode.TreeDataProvider<vscode.TreeItem> {

	private _onDidChangeTreeData: 
		vscode.EventEmitter<vscode.TreeItem | undefined> 
			= new vscode.EventEmitter<vscode.TreeItem | undefined>();
	readonly onDidChangeTreeData: 
		vscode.Event<vscode.TreeItem | undefined> 
			= this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {}

	refresh(): void {
		console.log("refreshing...");
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {

		/* first time */
		if (element == undefined) {
			/* check the network for Toradex devices */
			return this.getDevicesFromNetwork();
		} else {
			let elem: Device = <Device> element;

			if (elem.label.indexOf("Toradex AG") != -1) {
				/* send device with ip to login */
				return this.loginTorizonAndGetModel(elem);

			} else if (elem.version && 
				elem.version.indexOf("device") != -1) {

				/* dumb tree */
				return this.createDockerPackagesTypes(elem);

			} else if (elem.label.indexOf("Images") != -1) {
				let el: ExpandImageContainers = 
					<ExpandImageContainers> element;

				/* check docker images */
				return this.requestDockerImages(el);
				
			} else if (elem.label.indexOf("Containers") != -1) {
				let el: ExpandImageContainers = 
					<ExpandImageContainers> element;

				/* check docker containers */
				return this.requestDockerContainers(el);

			}  else {
				let docker: DockerImage = <DockerImage> element;

				if (docker.type === "container") {
					let opts: ContainerOptions[] = [];

					opts.push(new ContainerOptions(
						"Start",
						docker.ip
					));
					opts[0].defineCommand(
						'extension.startContainer',
						docker.name, 
						docker.ip,
						opts[0]
					);

					opts.push(new ContainerOptions(
						"Stop",
						docker.ip
					));
					opts[1].defineCommand(
						'extension.stopContainer',
						docker.name,
						docker.ip,
						opts[1]
					);

					opts.push(new ContainerOptions(
						"Restart",
						docker.ip
					));
					opts[2].defineCommand(
						'extension.restartContainer',
						docker.name,
						docker.ip,
						opts[2]
					);

					opts.push(new ContainerOptions(
						"Remove",
						docker.ip
					));
					opts[3].defineCommand(
						'extension.deleteContainer',
						docker.name,
						docker.ip,
						opts[3]
					);;

					return Promise.resolve(opts);
				} else if (docker.type === "image") {
					/* let made some operations on the images */
					let opts: ContainerOptions[] = [];

					opts.push(new ContainerOptions(
						"Run",
						docker.ip
					));
					opts[0].defineCommand(
						'extension.runContainer',
						docker.name, 
						docker.ip,
						opts[0]
					);

					opts.push(new ContainerOptions(
						"Run Xorg",
						docker.ip
					));
					opts[1].defineCommand(
						'extension.runXorgContainer',
						docker.name, 
						docker.ip,
						opts[1]
					);

					opts.push(new ContainerOptions(
						"Run Weston",
						docker.ip
					));
					opts[2].defineCommand(
						'extension.runWestonContainer',
						docker.name, 
						docker.ip,
						opts[2]
					);

					opts.push(new ContainerOptions(
						"Run command",
						docker.ip
					));
					opts[3].defineCommand(
						'extension.runCommandContainer',
						docker.name, 
						docker.ip,
						opts[3]
					);

					opts.push(new ContainerOptions(
						"Run docker.run",
						docker.ip
					));
					opts[4].defineCommand(
						'extension.runDockerRunFileContainer',
						docker.name, 
						docker.ip,
						opts[4]
					);

					return Promise.resolve(opts);
				}
			}
		}

		return Promise.resolve([]);
	}

	private getDevicesFromNetwork(): Promise<Device[]> {
		return new Promise(resolve => {
			netList.scan({}, (err: any, arr: any) => {
				var objs: Device[] = [];

				for (var i = 0; i < arr.length; i++) {
					if (arr[i].vendor === 
						"Toradex AG") {

						objs.push(new Device(
							arr[i].vendor, 
							arr[i].ip, 
							1
						));
						console.log(arr[i].ip);
					}
				}

				if (objs.length < 1)
					vscode.window
					.showWarningMessage(
						"No Toradex devices detected");

				console.log("resolve");
				resolve(objs);
			});
		});
	}

	private loginTorizonAndGetModel(elem: Device): Promise<Device[]> {
		var ssh = new SSH({
			host: elem.version,
			user: 'torizon',
			pass: 'torizon'
		});

		return new Promise(resolve => {
			ssh.exec('cat /proc/device-tree/model', {
				out: function(stdout: string) {
					stdout = stdout
					.replace("Toradex ", "");
					console.log(stdout);
					
					resolve([new Device(
						stdout,
						"device",
						1,
						elem.version
					)]);
				}
			}).start();
		});
	}

	private createDockerPackagesTypes(elem: Device): 
			Promise<ExpandImageContainers[]> {
		/* dumb tree */
		let dumbs: ExpandImageContainers[] = [];

		dumbs.push(new ExpandImageContainers(
			"Images",
			(elem.ip ? elem.ip : ""),
			1
		));

		dumbs.push(new ExpandImageContainers(
			"Containers",
			(elem.ip ? elem.ip : ""),
			1
		));

		return Promise.resolve(dumbs);
	}

	private requestDockerImages(el: ExpandImageContainers): 
			Promise<DockerImage[]> {
		var ssh = new SSH({
			host: el.ip,
			user: 'torizon',
			pass: 'torizon'
		});

		return new Promise(resolve => {
			ssh.exec('docker images', {
			exit: function(
				code: number, stdout: string, 
				stderr: string ) 
			{
				let objs: DockerImage[] = [];
				let lines = stdout.split("\n");
				
				/* check lines and get what I need */
				for (var i = 1; i < lines.length; i++) {

					if (lines[i] != "") {
						let members = 
							lines[i]
							.split(/\s{2,}(.*?)\s{2,}/);
						
						let dockImg: DockerImage = 
						new DockerImage(
							members[0],
							members[1],
							members[2],
							parseInt(
							members[4].replace("MB", "")
							),
							"image",
							el.ip
						);

						objs.push(dockImg);
					}
				}

				resolve(objs);
			}}).start();
		});
	}

	private requestDockerContainers(el: ExpandImageContainers): 
			Promise<DockerImage[]> {
		
		var ssh = new SSH({
			host: el.ip,
			user: 'torizon',
			pass: 'torizon'
		});

		return new Promise(resolve => {
			ssh.exec('docker container ls -a', {
			exit: function(code: number, stdout: string, stderr: string ) {
				let objs: DockerImage[] = [];
				let lines = stdout.split("\n");
				/* check lines and get what I need */
				for (var i = 1; i < lines.length; i++) {

					if (lines[i] != "") {
						let members = 
							lines[i]
							.split(/\s{2,}(.*?)\s{2,}/);

						let dockImg: DockerImage = 
						new DockerImage(
							members[6],
							members[1],
							members[0],
							0,
							"container",
							el.ip,
						);

						objs.push(dockImg);
					}
				}

				resolve(objs);
			}}).start();
		});
	}
}

class ContainerOptions extends vscode.TreeItem {
	public deleted = false;
	
	constructor(
		public readonly label: string,
		public ip: string
	) {
		super(label, 0);
	}

	get tooltip(): string {
		return `${this.label}`;
	}

	get description(): string {
		return "";
	}

	defineCommand(cmd: string, name: string, ip: string, 
			item: vscode.TreeItem): void {
		this.command = {
			command: cmd,
			title: '',
			arguments: [name, ip, item]
		}
	}

	iconPath = {
		light: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'light', 
			'exec.svg'
		),
		
		dark: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'dark', 
			'exec.svg'
		)
	};

	contextValue = 'ExpandContainersImage';
}

class ExpandImageContainers extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public ip: string,
		public readonly collapsibleState: 
			vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}`;
	}

	get description(): string {
		return "";
	}

	iconPath = {
		light: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'light', 
			'box.svg'
		),
		
		dark: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'dark', 
			'box.svg'
		)
	};

	contextValue = 'ExpandContainersImage';
}

class DockerImage extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		public readonly tag: string,
		public readonly id: string,
		public readonly size: number,
		public readonly type: string,
		public readonly ip: string,
		public readonly command?: vscode.Command
	)
	{
		super(name, 1);
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	get description(): string {
		if (this.size > 0)
			return `${this.size}MB`;
		return `${this.tag}`;
	}

	iconPath = {
		light: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'light', 
			'docker.svg'
		),
		
		dark: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'dark', 
			'docker.svg'
		)
	};

	contextValue = 'DockerIMG';
}

export class Device extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public version: string,
		public readonly collapsibleState: 
			vscode.TreeItemCollapsibleState,
		public readonly ip?: string,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}-${this.version}`;
	}

	get description(): string {
		return this.version;
	}

	iconPath = {
		light: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'light', 
			'module.svg'
		),
		
		dark: path.join(
			__filename, 
			'..', 
			'..', 
			'resources', 
			'dark', 
			'module.svg'
		)
	};

	/* TODO define a torizonDevice */
	contextValue = 'device';
}
