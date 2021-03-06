import * as vscode from 'vscode';
import { Device, DockerImage } from './TorizonDevProvider';
const SSH = require('simple-ssh');
const network = require('network');
const fs = require('fs');

export class SSHCommands {
	private ssh: any;
	private localPath: string = <string> vscode.workspace.rootPath;

	constructor(private ip: string)
	{
		this.ssh = new SSH({
			host: ip,
			user: 'torizon',
			pass: 'torizon'
		});
	}

	runDockerWithMyRegistry(): Promise<boolean> {

		let ssh = this.ssh;

		/* first get my local ip */
		return new Promise(resolve => {
			network.get_active_interface(function(err: any, obj: any) {
				if (!err) {
					let myip = obj.ip_address;
					ssh.exec(`echo 'torizon' | sudo -S bash -c "echo '{ \\\"insecure-registries\\\" : [\\\"${myip}:5000\\\"] }' > /etc/docker/daemon.json && systemctl restart docker"`, {
						out: function(stdout: string) {
							/* we will never reach this */
							console.log(stdout);
							resolve(false);
						},
						err: function(stderr: string) {
							if (stderr.indexOf("Password") == -1)
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							console.log(code);
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				} else {
					vscode.window.showWarningMessage("No internet connection? 🤔");
					resolve(false);
				}
			});
		});
	}

	pullImageFromDockerHub(winOut: vscode.OutputChannel): Promise<boolean> {
		let ssh = this.ssh;

		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "torizon/arm32v7-debian-weston"
		}

		/* first get my local ip */
		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(value => {
				if (value != undefined) {
					winOut.show();
					ssh.exec(`docker pull ${value}`, {
						out: function(stdout: string) {
							winOut.appendLine("✔️" + stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0) {
								vscode.window.showInformationMessage(`Image ${value} downloaded with success 😎`);
								resolve(true);
							} else
								resolve(false);
						}
					}).start();
				}
			});
		});
	}

	pullImageFromMyRegistry(name: string, winOut: vscode.OutputChannel): Promise<boolean> {
		let ssh = this.ssh;

		/* first get my local ip */
		return new Promise(resolve => {
			network.get_active_interface(function(err: any, obj: any) {
				if (!err) {
					let myip = obj.ip_address;
					ssh.exec(`docker pull ${myip}:5000/${name}`, {
						out: function(stdout: string) {
							winOut.appendLine("✔️" + stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				} else {
					vscode.window.showWarningMessage("No internet connection? 🤔");
					resolve(false);
				}
			});
		});
	}

	startContainer(name: string): void 
	{
		this.ssh.exec(`docker start ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim()) {
					vscode.window.showInformationMessage(`${name} started 😎`);
				} else {
					vscode.window.showErrorMessage(`Error trying to start ${name}`);
				}
			},
			err: function(stderr: string) {
				vscode.window
					.showErrorMessage(stderr);
			},
		}).start();
	}

	stopContainer(name: string): void
	{
		this.ssh.exec(`docker stop ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim()) {
					vscode.window.showInformationMessage(`${name} stoped 😎`);
				} else {
					vscode.window.showErrorMessage(`Error trying to stop ${name}`);
				}
			},
			err: function(stderr: string) {
				vscode.window
					.showErrorMessage(stderr);
			},
		}).start();
	}

	restartContainer(name: string): void
	{
		this.ssh.exec(`docker restart ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim())
					vscode.window.showInformationMessage(`${name} restarted 😎`);
				else
					vscode.window.showErrorMessage(`Error trying to restart ${name}`);
			},
			err: function(stderr: string) {
				vscode.window
					.showErrorMessage(stderr);
			},
		}).start();
	}

	deleteContainer(name: string): Promise<boolean>
	{
		//vscode.window.showQuickPick(["Yes", "No"]);

		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "Are you sure you want to remove this container?"
		}
		
		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(value => {
				if (value != undefined) {
					/* so this is an yes */
					this.ssh.exec(`docker rm -vf ${name}`, {
						out: function(stdout: string) {
							if (name == stdout.trim()) {
								vscode.window.showInformationMessage(`${name} removed 😎`);
								resolve(true);
							} else {
								vscode.window.showErrorMessage(`Error trying to remove ${name}`);
								resolve(false);
							}
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
					}).start();
				}
			});
		});
	}

	runImage(name: string, image: DockerImage): Promise<boolean>
	{
		return new Promise(resolve => {
			/* normal run */
			this.ssh.exec(`docker run -d -it ${name}:${image.tag}`, {
				out: function(stdout: string) {
					console.log(stdout);
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				},
				exit: function(code: any) {
					if (code === 0)
						resolve(true);
					else
						resolve(false);
				}
			}).start();
		});
	}

	runImageWithCmd(name: string, image: DockerImage): Promise<boolean>
	{
		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "cmd arg1 arg2 arg3"
		}

		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(args => {
				if (args != undefined) {
					/* run generic with arguments */
					this.ssh.exec(`docker run \
					-d -it \
					--privileged \
					-v /var/run/dbus:/var/run/dbus \
					-v /dev:/dev \
					-v /tmp:/tmp \
					${name}:${image.tag} \
					${args}`, {
						out: function(stdout: string) {
							console.log(stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				}
			});
		});
	}

	runImageWithArgs(name: string, image: DockerImage): Promise<boolean>
	{
		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "arg1 arg2 arg3"
		}

		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(args => {
				if (args != undefined) {
					/* run generic with arguments */
					this.ssh.exec(`docker run \
					${args} \
					${name}:${image.tag}`, {
						out: function(stdout: string) {
							console.log(stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				}
			});
		});
	}

	runXorgImage(name: string, image: DockerImage): Promise<boolean>
	{
		return new Promise(resolve => {
			/* normal run */
			this.ssh.exec(`docker run \
			-d -it --privileged \
			-v /var/run/dbus:/var/run/dbus \
			-v /dev:/dev ${name}:${image.tag} startx`, {
				out: function(stdout: string) {
					console.log(stdout);
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				},
				exit: function(code: any) {
					if (code === 0)
						resolve(true);
					else
						resolve(false);
				}
			}).start();
		});
	}

	runWestonImage(name: string, image: DockerImage): Promise<boolean>
	{
		return new Promise(resolve => {
			let usePixman: string = "";

			if (image.father.label.indexOf("iMX7D") != -1) {
				usePixman = "-- --use-pixman";
			}

			/* weston imx6 */
			this.ssh.exec(`docker run \
			-d -it --privileged \
			-v /tmp:/tmp \
			${name}:${image.tag} \
			weston-launch --tty=/dev/tty7 --user=root ${usePixman}`, {
				out: function(stdout: string) {
					console.log(stdout);
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				},
				exit: function(code: any) {
					if (code === 0)
						resolve(true);
					else
						resolve(false);
				}
			}).start();
		});
	}

	runExtensionDockerRunFile(name: string, image: DockerImage): Promise<boolean>
	{
		let tag = image.tag;
		let cmd = "";

		try {
			fs.readFileSync(`${this.localPath}/docker.run`, 'utf8');
		} catch (err) {
			if (err.errno == -2)
				vscode.window.showErrorMessage("No docker.run file on your project folder 🤔");
			else
				vscode.window.showErrorMessage(err);
			return Promise.resolve(false);
		}

		if (cmd.indexOf("${image}") != -1) {
			cmd = cmd.replace("${image}", `${name}:${tag}`);
		}

		/* open the file */
		return new Promise(resolve => {
			this.ssh.exec(cmd, {
				out: function(stdout: string) {
					console.log(stdout);
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				},
				exit: function(code: any) {
					if (code === 0)
						resolve(true);
					else
						resolve(false);
				}
			}).start();
		});
	}

	importImage(fileName: string, out: vscode.OutputChannel): Promise<boolean>
	{
		return new Promise(resolve => {
			this.ssh.exec(`docker load --input /home/torizon/${fileName}`, {
				out: function(stdout: string) {
					console.log(stdout);
					out.appendLine("");
					out.appendLine(stdout);

					if (stdout.indexOf("Loaded") != -1) {
						resolve(true);
					} else {
						resolve(false);
					}
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				}
			}).start();
		});
	}

	deleteImage(id: string): Promise<boolean>
	{
		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "Are you sure you want to remove this Image?"
		}

		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(value => {
				if (value != undefined) {
					this.ssh.exec(`docker rmi ${id}`, {
						out: function(stdout: string) {
							console.log(stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				}
			});
		});
	}
}
