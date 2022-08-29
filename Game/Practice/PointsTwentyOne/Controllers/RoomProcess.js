var Sys = require('../../../../Boot/Sys');

module.exports = {
  checkRoomSeatAvilability: async function(data){
      try {
          /**/
           let room,rooms,isEmptySpace;
          /**/
          Sys.Log.info('<=> Check Room Seat Avilability Called || ');
          let query= {
                type: 'Practice', // 'Practice','Cashgame',''
                tableType: data.gameType, // 'Points','Pool','Deals'
                maxPlayers: data.noOfSeats,
                owner: 'user',
                pointsValue: data.pointsValue,
                // entryFees :data.entry_fee,
                // timerStart : false,
                status: { $nin: ['Running', 'Closed'] }, // When Table is Running, player can not sit on table, but can sit when a game is over.
                // status: 'waiting',
                // status: { $ne: 'Running' }, // When Table is Running, player can not sit on table.
                // status: { $ne: 'Finished' }, // When Table is Finished, player can not sit on table.
                // status: { $ne: 'Closed' },
            }
          // if (data.gameType == 'Points' ) {
          //   query.pointsValue  = data.pointsValue
          // }
        rooms = await Sys.Game.Common.Services.RoomServices.getByData(query);


          isEmptySpace = false;
          if (rooms) {
            rooms.forEach(function (rm) {
              let playersLength = 0;
              for (var i = 0; i < rm.players.length; i++) {
                if (rm.players[i] && rm.players[i].status != 'Left') {
    					    playersLength += 1;
    				    }
			        }

              if (playersLength < rm.maxPlayers && isEmptySpace == false) {
        			  isEmptySpace = true;
        				room = rm; // Assign to Room
        			}
		          });
          }

          if (isEmptySpace == false) {
              Sys.Log.info('<=> Create New Room || ');

              let rm = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.create(data);
              if (!rm) {
                  return { status: 'fail', result: null, message: 'No Room Created 1.', statusCode: 401 }
              }
              room = rm; // Assign to Room
		}
		room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(room.id); //// Just Get Table Data With Format.

		return room;
      }catch (error) {

		Sys.Log.info('Error in checkRoomSeatAvilability : ' + error);
		return new Error('Error in checkRoomSeatAvilability');
      }
  },
  joinRoom: async function(player,data){
      try {


		let i = 0;
          Sys.Log.info('<=> Join Room Called || ');

		let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);



          if (!room) {
              return { status: 'fail',result: null,message: "Room not found",	statusCode: 401	};
          }
		////console.log("Room------>",room);

		let oldPlayer = null;
		let playingPlayerCount = 0;
          if (room.players.length > 0) {
              for (i = 0; i < room.players.length; i++) {
                  if (room.players[i].id == player.id) {
                      oldPlayer = room.players[i]
                      break
                  }
              }
		}
		// chek seat in players array
		let seatAvailable = false
		let playerCount = 0;
		let allSeatIndex = [];
			for (let i = 0; i < room.players.length; i++) {
				if (room.players[i].status != 'Left') {
					playerCount++;
					allSeatIndex.push(room.players[i].seatIndex);
				}
			}

		if (playerCount < room.maxPlayers) {
			// let Find Free SeatIndex
			for (let k = 0; k < room.maxPlayers; k++) {
				 if(!allSeatIndex.includes(k)){
					seatAvailable = true;
			 		data.seatIndex = k;
			 		break;
				 }
			}

		}

		// When Fist User Wants to Push on Table.
		if(allSeatIndex.length == 0){
			seatAvailable = true;
			data.seatIndex = 0;
		}

		// if seat is available add player
		if (seatAvailable) {


			let playerStatus = (room.status == 'waiting' || room.status == 'finished') ? 'sitting' : 'waiting';

			if (oldPlayer)
			{
				//console.log('<=> Old Player Match || ',playerStatus);
				oldPlayer.chips       = parseInt(player.chips);
				oldPlayer.socketId    = player.socketId;
				oldPlayer.seatIndex   = data.seatIndex;
				oldPlayer.isBot       = data.isBot;
				oldPlayer.dropped     = false;
				oldPlayer.status      = playerStatus;
				// oldPlayer.cardTurn    = true;
				oldPlayer.declare     = false;
				oldPlayer.playerScore = 120;
				oldPlayer.totalPoint  = 0;
				oldPlayer.turnCount   = 1;

        oldPlayer.cardTurn    = false;
        if (oldPlayer.cards.length > 21) {
          oldPlayer.cardTurn  = true;
        }
				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

			}else
			{
				await room.AddPlayer(player.id, player.socketId, player.username,playerStatus,0, player.appId, parseInt(player.chips), 0, data.seatIndex, false);
			}

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

				let totalPlayers=0;
				let playerInfoDummy = [];
				let joinedPlayer = null;
					for (i = 0; i < room.players.length; i++) {
						if(room.players[i].status != 'Left'){
							totalPlayers++;
							let playerInfoObj = {
								id : room.players[i].id,
								status : room.players[i].status,
								username : room.players[i].username,
								cash : room.players[i].cash,
								chips : parseInt(room.players[i].chips),
								appId :room.players[i].appid,
								avatar :  room.players[i].appid,
								dropped : room.players[i].dropped,
							};

							playerInfoDummy.push(playerInfoObj);
						if (room.players[i].id == player.id) {
						joinedPlayer = {
								id : room.players[i].id,
								status : room.players[i].status,
								username : room.players[i].username,
								cash : room.players[i].cash,
								chips : parseInt(room.players[i].chips),
								appId :room.players[i].appid,
								avatar :  room.players[i].appid,
								dropped : room.players[i].dropped,
							};
						}

					}
				}
        let roomStatus = true;
        if (room.status == "Running" && room.game != null) {
          roomStatus = false;
        }

        await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('JoinedPlayerInfo',joinedPlayer, { isBeforeGameStart: roomStatus });
        await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(data.socketId).emit('PlayerList', playerInfoDummy, { isBeforeGameStart: roomStatus });
				Sys.Log.info('<=> Player count (NewPlayer) || Player Length :'+totalPlayers);
				if (totalPlayers > 0) {

					// if (totalPlayers > 0) {
					// 	// room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);
					// }

					// Game Start
					let playersLength = 0
					for (let i=0; i < room.players.length; i += 1) {
						if (room.players[i].status != 'Left') {
							playersLength += 1;
						}
					}

					if (room.status != 'Running' && playersLength >= room.minPlayers) {
						//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>:::::");
						//console.log("room.timerStart : ",room.timerStart);
						//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>:::::");

						if (room.game == null && room.timerStart == false) {
							room.timerStart = true; // When 12 Second Countdown Start.
							room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
							//console.log('<=> Game Not Running (NewPlayer)');
							clearTimeout(Sys.Timers[room.id]); // Clear Old Timer First
							let	timer = parseInt(Sys.Config.Rummy.waitBeforeGameStart);
								Sys.Timers[room.id] = setInterval(async function(room){
									//console.log("OnGameStartWait Send => ",Sys.Config.Namespace.PracticePointsTwentyOne,'---', room.id);

									await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnGameStartWait', {
										roomId: room.id,
										timer : timer,
										maxTimer :  parseInt( Sys.Config.Rummy.waitBeforeGameStart)
									});
									timer--;
									if(timer < 1){
										clearTimeout(Sys.Timers[room.id]); // Clear Room Timer
										room.timerStart = false; // Reset Timer Variable
										room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
										playersLength = 0;
										for (let i=0; i < room.players.length; i += 1) {
											if (room.players[i].status != 'Left') {
												playersLength += 1;
											}
										}
										//console.log('<===============================>');
										//console.log('<=> Game Starting [] New <=>',playersLength);
										//console.log('<===============================>');
										 if(playersLength >= room.minPlayers){
                       room.status = 'Running';
                       await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
											room.StartGame();
										 }else{
											//console.log('<=> Some Player Leave So not Start Game. <=>',playersLength);
										 }
									}
								}, 1000, room);
						}else{


							if(room.game == null){
								//console.log('<=> Game Not Running (NewPlayer)');
							}
							//console.log('<=> Game Object Present So Please Wait For Game Finished');
						}
					}
					if (playersLength < room.minPlayers) {
						//console.log('<=> Game IN waiting Stage  (NewPlayer)');
						room.status = 'waiting'
						roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
					}

					return room;
				}



		} else {
      //console.log("*************************************************************");
      //console.log("No Sit Avilable");
      //console.log("*************************************************************");
			return new Error('No Sit Avilable');
		}


      }catch (error) {
		Sys.Log.info('Error in joinRoom : ' + error);
		return new Error('Error in joinRoom');

      }
  },
  newGameStarted: async function(room) {
  	try {
  		//console.log('<=>Practice Game Started Brodcast || GameStarted :',Sys.Config.Namespace.PracticePointsTwentyOne,room.id);
  		await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('GameStarted', {
  			message : 'Let Start Game',
  			gameId : room.game.id,
  			gameNumber : room.game.gameNumber
  		});
  	}catch (error) {
  		Sys.Log.info('Error in newGameStarted : ' + error);
  		return new Error('Error in newGameStarted');

  	}
	},
	turnPlayerSelection: async function(room,cardsArray) {
		try{
			let playersCards = [];
			for (let i = 0; i < room.players.length; i += 1) {
				//console.log("players room.players[i].id :",room.players[i].id);
				//console.log("players cardsArray[i] :",cardsArray[i]);
					playersCards.push({
						playerId : room.players[i].id,
						card : cardsArray[i],
						index : i,
					})
			}
			//console.log("players Cards :",playersCards);
			// Find High Cards
			let playerId = null;
			let maxRank = 1;
			for (let i = 0; i < playersCards.length; i += 1) {
				if(maxRank < parseInt(playersCards[i].card.slice(0,1))){
					maxRank = parseInt(playersCards[i].card.slice(0,1));
					playerId = playersCards[i].playerId;
					// room.currentPlayer = playersCards[i].index;
				}
			}
			//console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.")
			//console.log("High Card Player User Name : ",room.getPlayerById(playerId).username)
			// //console.log("Index : ",room.currentPlayer)
			//console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.")
			let sellectObj = {
				playerCards : playersCards,
				highCardPlayer : playerId
			}
			//console.log("sellectObj Cards :",sellectObj);
			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('priorityCards', sellectObj);
			return room;
		}catch (error) {
			Sys.Log.info('Error in turnPlayerSelection : ' + error);
			return new Error('Error in turnPlayerSelection');

		}
	},
	newRoundStarted: async function(room) {
		try{
			//console.log('<=> Game || newRoundStarted :',room.game.gameNumber);
      		//room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);
			////console.log("New round Started", room.game);
			roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
			if (!roomUpdated) {
				return {
					status: 'fail',
					result: null,
					message: "Room not found",
					statusCode: 401
				};
			}


			// Send Room Joker Cards & OpneDeck Card information

      // TWENTYONE_CHANGE
      let isPrintedJoker  = false;
      let jokerCard       = room.game.jokerCard[0];
      if (room.game.jokerCard[0] == 'PJ') {
        isPrintedJoker  = true;
        jokerCard       = 'AS';
      }
			let joObj = {
        upperJoker2     : '',
        upperJoker1     : room.game.upperJoker[0],
        lowerJoker2     : '',
        lowerJoker1     : room.game.lowerJoker[0],
				jokerCard       : jokerCard,
				OpenCard        : room.game.openDeck[0],
        isPrintedJoker  : isPrintedJoker,
        isReJoin				: false
			}
			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('JokerOpenCardInfo', joObj);
      // //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      // //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      // //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      // //console.log("JokerOpenCardInfo",joObj);
      // //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      // //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      // //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");

			room.players.forEach(async function (player) {
				let playerCards = {
					playerId : player.id,
					cards : player.cards,
				};
				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerDeck', playerCards);
			});
			// Send Second Timer Player Deck for Testing.
			// room.players.forEach(async function (player) {
			// 	let playerCards = {
			// 		playerId : player.id,
			// 		cards : player.cards,
			// 	};
			// 	await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerDeck', playerCards);
			// });

			Sys.Timers[room.id] = setTimeout(async function (room) {

				// Change Current Player Tuen
				let currentPlayer = room.getCurrentPlayer();
				////console.log("currPlr",currentPlayer);
				currentPlayer.cardTurn = false; // Set Turn Variable False.
				currentPlayer.turnCount = parseInt(currentPlayer.turnCount) + 1; // Update Player Turn Count
				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

				//console.log("NextTurnPlayer Send");
				//console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.")
				//console.log("Player Turn : ",room.getCurrentPlayer().username)
				//console.log("Index : ",room.currentPlayer)
				//console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.")

				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('TurnPlayer', {
					playerId: room.players[room.currentPlayer].id
				});

					let timer = parseInt(Sys.Config.Rummy.turnTime21);
					Sys.Timers[room.id] = setInterval(async function(room){
						//console.log("turnTime First Timer Send ->",timer);
						await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnTurnTimer', {
							playerId: room.players[room.currentPlayer].id,
							timer : timer,
							maxTimer :  parseInt(Sys.Config.Rummy.turnTime21),
							name : 'turnTime'
						});
						timer--;
						if(timer < 1){
							clearTimeout(Sys.Timers[room.id]); // Clear Turn Timer
							timer = parseInt(currentPlayer.extraTime);
							let  extraTimer = parseInt(currentPlayer.extraTime);
							if(extraTimer < 1){
								clearTimeout(Sys.Timers[room.id]); // Clear Turn Timer
                //console.log("**************************************************");
                //console.log("**************************************************");
                //console.log("**************************************************");
								//console.log("Turn - check is timer not Close...");
                //console.log("**************************************************");
                //console.log("**************************************************");
                //console.log("**************************************************");
								Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.playerDefaultAction(room.id);
							}else{
								Sys.Timers[room.id] = setInterval(async function(room){
									//console.log("extraTime First Timer Send ->",timer);
									await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnTurnTimer', {
										playerId: room.getCurrentPlayer().id,
										timer : timer,
										maxTimer :  extraTimer,
										name : 'extraTime'
									});
									timer--;
									currentPlayer.extraTime = timer;
									if(timer < 1){
										clearTimeout(Sys.Timers[room.id]); // Clear Turn Timer
                    //console.log("**************************************************");
                    //console.log("**************************************************");
                    //console.log("**************************************************");
										//console.log("Turn - check is timer not Close...");
                    //console.log("**************************************************");
                    //console.log("**************************************************");
                    //console.log("**************************************************");
										Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.playerDefaultAction(room.id);
									}
								}, 1000, room);
							}

						}
					}, 1000, room);


			}, (500 * room.players.length) + 4000, room)
			return;
		}catch (error) {
			Sys.Log.info('Error in newRoundStarted : ' + error);
			return new Error('Error in newRoundStarted');

		}
	},
	playerDefaultAction: async function(id) {
		try {
		//console.log('playerDefaultAction called');
		clearTimeout(Sys.Timers[id]);
		let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(id);

		if (room.getCurrentPlayer()) {
			let currentPlayer = room.getCurrentPlayer();
			//console.log("currentPlayer.droppedCount->>",currentPlayer.droppedCount);
			if(currentPlayer.droppedCount == 2){
				//console.log("Remove Player for 3 Default Turn");
        currentPlayer.dropped = true;
				let playerData = {
					playerId : currentPlayer.id,
					roomId : room.id
				}


				let responce =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.leftRoom(playerData);
        if(responce instanceof Error){
    			return { status: 'fail', result: null, message: responce.message, statusCode: 401 }
    		}
				//Save History
				let dataObj = {
					playerId:currentPlayer.id,
					action: 'Left Player For 3 Defult Turn',
					card : '',
					cardString : '',
					time : Date.now()
				}
				room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);

				// //console.log("Default Turn Player",responce);

			}else{
				currentPlayer.droppedCount = parseInt(currentPlayer.droppedCount) + 1;

				// Player Auto Discards
				// check Player Have Auto Discard Cards
				let  playercards = currentPlayer.cards.length;
				if(playercards == 22){
					//console.log("Auto Discrds Working..............................");
          //console.log("===========================================================");
          //console.log("==================Card is removed while Auto Discard========================");
          //console.log("===========================================================");
					let card = currentPlayer.cards.splice(currentPlayer.cards.length - 1,1);
					//console.log("Card : ",card[0]);
					room.game.openDeck.push(card[0]);
					await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnAutoDiscard', {
						playerId: currentPlayer.id,
						card : card[0],
					});


					//Save History
					let dataObj = {
						playerId:currentPlayer.id,
						action: 'Auto Discard',
						card : card[0],
						cardString : '',
						time : Date.now()
					}
					room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);
				}

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
				await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.changeTurn(room);
				await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.turnFinished(room);
			}

		}
	 }catch (error) {
  		Sys.Log.info('Error in playerDefaultAction : ' + error);
  		return new Error('Error in playerDefaultAction');

  	}
	},
	leftRoom: async function(data) {
		try {
			////console.log("LeftRoom Data", data);
		   if (!data.roomId) {
			 //  //console.log('<=> Removing Player RoomID Not Found');
			   return {
				   status: 'fail',
				   result: null,
				   message: "Room Not Found",
				   statusCode: 401
			   };
		   }
		   let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);

		   if (!room) {
		  ////console.log('<=> Removing Player Room Not Found');
			   return {
				   status: 'fail',
				   result: null,
				   message: "Room Not Found",
				   statusCode: 401
			   };
		   }
		   //console.log('<=> LeftRoom Called || GAME-NUMBER [] || Data : ',data);
		   //check for user already present //
		   // chek seat in players array
		   let player = null;
		   let playerId = 0;
		   let removePlayer = false; // When Player Status is 'sitting' Or 'waiting' So Left Player From Room;
		   if (room.players.length > 0) {
			   for (let i = 0; i < room.players.length; i++) {
				   if (room.players[i].id == data.playerId && room.players[i].status != 'Left') {

					   if(room.players[i].status == 'sitting' || room.players[i].status == 'waiting'){
						   removePlayer = true;
					   }


					   player = room.players[i];
					   room.players[i].status = 'Left';
             // TWENTYONE_CHANGE
              if (room.players[i].dropped == false) {
                if(room.players[i].turnCount == 2  || room.players[i].turnCount == 1 ){
                   room.players[i].playerScore = Sys.Config.Rummy.playerFirstDrop_21;
    						}else if(room.players[i].turnCount == 3){
    							room.players[i].playerScore = Sys.Config.Rummy.playerSecondDrop_21;
    						}else{
    							room.players[i].playerScore = Sys.Config.Rummy.playerThirdDrop_21;
    						}
              }
              //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].username);
              //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);
              //console.log("666666666666666666666666666666666666666666666666666666655");
              //console.log("666666666666666666666666666666666666666666666666666666655");
					   playerId = room.players[i].id;

             // Push Player in Looser Array.
              // This is Code For Testing Loser Array.
              let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(room.players[i].id);
              let newChips = parseInt(playerObj.chips)-( parseInt(room.players[i].playerScore) * parseInt(room.pointsValue));
              if (( parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)) > playerObj.chips) {
                newChips = 0;
              }
              // let newChips = parseInt(playerObj.chips)-( parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue));
              let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });
              room.gameLosers.push({
                id : room.players[i].id,
                username :room.players[i].username,
                score : parseInt(room.players[i].playerScore),
                cards : room.players[i].cardsString,
                loss : parseInt(parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)),
                // loss : parseInt(parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue)),
                dropped : room.players[i].dropped
              })
					   break;
				   }
			   }
		   }
		   if (player) {
			  // //console.log('<=> Removing Player || GAME-NUMBER [] ||');

			   if (room.game && room.game.status == 'Running') {

				   ////console.log('<=> Game PlayerLeft Broadcast || GAME-NUMBER [] || PlayerLeft : ',player.username);
				   room  = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.checkTurnFinished(room,playerId);

			   }
			 //  //console.log('Remove Player 123');

			   if(removePlayer){
				   for (let i = 0; i < room.players.length; i++) {
					   if (room.players[i].status == 'Left' && room.players[i].id == playerId) {
						   room.players.splice(i, 1);
					   }
				   }
			   }

			   roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);



		   await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerLeft', { 'playerId': player.id });

		  // room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);
			   return {
				   status: 'success',
				   message: "Player Leave success",
				   statusCode: 200
			   };
		   } else {
			  // //console.log('<=> Removing Player Not Found');
			   return {
				   status: 'fail',
				   result: null,
				   message: "Player not found",
				   statusCode: 401
			   };
		   }
		}catch (error) {
			Sys.Log.info('Error in leftRoom : ' + error);
			return new Error('Error in leftRoom');

		}
	},
	broadcastPlayerInfo: async function(room) {
		try {
			// let seatIndexArray = [room.maxPlayers-1];
			let totalPlayers=0;
			for (var i = 0; i < room.players.length; i++) {
				if(room.players[i].status != 'Left'){
					totalPlayers++;
				}
			}
      		let playerInfoDummy = [];
			 let playerFreeSeats = [];
			// Just Send Player Info for Remainig Player
			for (var i = 0; i < room.players.length; i++) {
				if(room.players[i].status != 'Left'){
					let playerInfoObj = {
						id : room.players[i].id,
						status : room.players[i].status,
						username : room.players[i].username,
						cash : room.players[i].cash,
						chips : parseInt(room.players[i].chips),
						appId :room.players[i].appid,
						avatar :  room.players[i].appid,
						dropped : room.players[i].dropped,
						seatIndex : room.players[i].seatIndex,
						totalPlayers : totalPlayers
					};

					playerInfoDummy.push(playerInfoObj);

					//console.log('<=> Send Self Players Broadcast  || PlayerInfo :',  room.players[i].username);

					// await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerInfo', playerInfoObj);
				}
			}
    for (var i = 0; i < 6; i++) {
      let seatMatch = false;
      for (var j = 0; j < room.players.length; j++) {
        if (i == room.players[j].seatIndex && room.players[j].status != "Left") {
          seatMatch = true;
        }
      }
      if (seatMatch == false) {
        playerFreeSeats.push(i)
      }
    }

    // let tempPlayerArr = []
    // for (var i = 0; i < playerInfoDummy.length; i++) {
    //   for (var k = 0; k < playerInfoDummy.length; k++) {
    //     if (i == playerInfoDummy[k].seatIndex) {
    //       tempPlayerArr.push(playerInfoDummy[k])
    //     }
    //   }
    // }

    // let dataArr = [];
    // dataArr.push(playerInfoDummy);
    // dataArr.push({vacantSeat: playerFreeSeats});
		await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('playerInfoDummy', playerInfoDummy,{vacantSeat: playerFreeSeats});
		return room;
	 }catch (error) {
		Sys.Log.info('Error in broadcastPlayerInfo : ' + error);
		return new Error('Error in broadcastPlayerInfo');

	 }
	},
	checkTurnFinished: async function(room,playerId) {
		try {
		//console.log('<=> checkTurnFinished  Called || GAME-NUMBER ['+room.game.gameNumber+'] || ');
		if (room.getCurrentPlayer().id == playerId) {
			await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.changeTurn(room);
			await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.turnFinished(room);
			return room;
		}else{
			let playinPlayer = 0;
			//console.log('Check Player Count.');
			// Count no Of Player
			for (let i=0; i < room.players.length; i += 1) {
				//console.log("room.players[i].status:",room.players[i].status);
				if (room.players[i].dropped === false && room.players[i].status === 'playing' ) {
					playinPlayer++;
				}
			}
			//console.log("No Of Player:",playinPlayer);
			if(playinPlayer == 1){
				clearTimeout(Sys.Timers[room.id]);
				room.timerStart = false;
				room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
				// Call Save History.
				room.game.status = 'Finished';
				await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.gameFinished(room);

			}
			return room;
		}
	 }catch (error) {
		Sys.Log.info('Error in checkTurnFinished : ' + error);
		return new Error('Error in checkTurnFinished');

	 }
	},
	changeTurn: async function(room) {
  	try {
  		let i;
  		let currentTurn = room.currentPlayer;
  		//console.log("Change Turn Current Turn:",currentTurn);
          //For each player, check
          for (i = currentTurn; i < room.players.length; i += 1) {
  			//console.log("room.players[i].dropped >>>",room.players[i].dropped)
  				//console.log("room.players[i].status >>>",room.players[i].status)
              if (room.players[i].dropped === false && room.players[i].status === 'playing' && i != room.currentPlayer) {
                  room.currentPlayer = i;
                  break
              }
  		}
  		//console.log("New :",currentTurn);
  		//console.log("Old Player Turn :",room.currentPlayer);
          if (currentTurn == room.currentPlayer) {
              for (i = 0; i < currentTurn; i += 1) {
  				//console.log("room.players[i].dropped",room.players[i].dropped)
  				//console.log("room.players[i].status",room.players[i].status)
                  if (room.players[i].dropped === false && room.players[i].status === 'playing') {
                      room.currentPlayer = i;
                      break;
                  }
              }
  		}
  		//console.log("New Player Turn :",room.currentPlayer);
  	}catch (error) {
  		Sys.Log.info('Error in changeTurn : ' + error);
  		return new Error('Error in changeTurn');

  	}
	},
	turnFinished : async function(room) {
		try {
  		let playinPlayer = 0;

      //console.log('<=> Turn Finished  Called || GAME-NUMBER [] || Clear TimeOut');
  		// //console.log('<=> Turn Finished  Called || GAME-NUMBER ['+room.game.gameNumber+'] || Clear TimeOut');

  		clearTimeout(Sys.Timers[room.id]);
  		room.timerStart = false;
  		roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

  		// Count no Of Player
  		for (let i=0; i < room.players.length; i += 1) {
  			//console.log("room.players[i].status:",room.players[i].status);
              if (room.players[i].dropped === false && room.players[i].status === 'playing') {
  				playinPlayer++;
              }
          }
  		//console.log("Player Count Turn Finished:",playinPlayer);
  		if(playinPlayer == 1 || playinPlayer == 0){
  			clearTimeout(Sys.Timers[room.id]); // Clear Room Timer
  			//console.log('<=> No Of Player 1 || GAME-NUMBER [] || Call Game Finished');
  			// Call Save History.
  			room.game.status = 'Finished';

  			await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.gameFinished(room);

  		}else{
  			if (room.getCurrentPlayer()) {

  				// Change Current Player Tuen
  				let currentPlayer = room.getCurrentPlayer();
  				currentPlayer.cardTurn = false; // Set Turn Variable False.
  				currentPlayer.turnCount = parseInt(currentPlayer.turnCount) + 1; // Update Player Turn Count
  				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

  				//console.log("NextTurnPlayer Send Second");
  				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('TurnPlayer', {
  					playerId: room.players[room.currentPlayer].id
  				});

  					let timer = parseInt(Sys.Config.Rummy.turnTime21);
  					Sys.Timers[room.id] =  setInterval(async function(room){
  						//console.log("turnTime NextTurnPlayer Send ->",timer);
  						////console.log("room.id->",room.id);
  						////console.log("room.players[room.currentPlayer].id->",room.players[room.currentPlayer].id);
  						await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnTurnTimer', {
  							playerId: room.players[room.currentPlayer].id,
  							timer : timer,
  							maxTimer :  parseInt(Sys.Config.Rummy.turnTime21),
  							name : 'turnTime'
  						});
  						timer--;
  						if( timer < 1){
  							clearTimeout(Sys.Timers[room.id]);
  							timer = parseInt(currentPlayer.extraTime);
  							let  extraTimer = parseInt(currentPlayer.extraTime);
  							Sys.Timers[room.id] =  setInterval(async function(room){
  								//console.log("extraTime NextTurnPlayer Send ->",timer);
  								// //console.log("RoomId:", room.players[room.currentPlayer].id);
  								// //console.log("PlayerId:", room.id);
  								await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnTurnTimer', {
  									playerId: room.players[room.currentPlayer].id,
  									timer : timer,
  									maxTimer :  extraTimer,
  									name : 'extraTime'
  								});
  								timer--;
  								currentPlayer.extraTime = timer;
  								if(timer < 1){
  										clearTimeout(Sys.Timers[room.id]); // Clear Turn Timer
  										//console.log("Turn - check is timer not Close...");
  										await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.playerDefaultAction(room.id);

  								}
  							}, 1000, room);
  						}
  					}, 1000, room);

  			}else{
          //console.log('<=> Current Player Not Found || GAME-NUMBER [] ||');
  				// //console.log('<=> Current Player Not Found || GAME-NUMBER ['+room.game.gameNumber+'] ||');
  			}

  		}
  	}catch (error) {
  		Sys.Log.info('Error in turnFinished : ' + error);
  		return new Error('Error in turnFinished');

  	}
	},
	gameFinished : async function(room) {
  	try {
  		if(room.status == 'Running'){

  		clearTimeout(Sys.Timers[room.id]);
  		room.status = "Finished"; // Set Finished. if anther process called Game Finished.
  		// Winner Calculation

  		let playinPlayer = 0;
  		let winner = null;
  		let winingChips = 0;
  		let winnerPlayers = [];
  		let playerInfoObj = {};
  		let singlePlayerWinnigchips = 0;
      //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      //console.log("singlePlayerWinnigchips1", singlePlayerWinnigchips);
      //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
  		// Check Winner is Single Player
      // //console.log("############################################################");
      // //console.log("############################################################");
      // //console.log("############################################################");
      // //console.log("############################################################");
      // //console.log(room.players);
      // //console.log("############################################################");
      // //console.log("############################################################");
      // //console.log("############################################################");
      // //console.log("############################################################");
  		for (let i=0; i < room.players.length; i += 1) {

        if (room.players[i].dropped == true) {
          //console.log('LosserPlayer', room.players[i].playerScore);
          if(room.players[i].turnCount == 2 || room.players[i].turnCount == 1){
            //console.log("First and second turn");
            room.players[i].playerScore = Sys.Config.Rummy.playerFirstDrop_21;
          }else if(room.players[i].turnCount == 3){
            //console.log("Third turn");
            room.players[i].playerScore = Sys.Config.Rummy.playerSecondDrop_21;
          }else{
            //console.log("Above third turn");
            //console.log('Sys.Config.Rummy.playerThirdDrop', Sys.Config.Rummy.playerThirdDrop_21);
            room.players[i].playerScore = Sys.Config.Rummy.playerThirdDrop_21;
          }
          // In case played has wrong declared
          if (room.players[i].wrongfinished == true) {
            // currentPlayer.wrongfinished = data.wrongfinished;
            room.players[i].playerScore = 120;
          }
        }

  			if (room.players[i].dropped === false && room.players[i].status === 'playing' ) {
  				winner = room.players[i]; // Use Player Winner When Single Player is Winner.
  				playinPlayer++;
  			}else{
          //
          singlePlayerWinnigchips  = parseInt(parseInt(singlePlayerWinnigchips) + parseInt(parseInt(room.players[i].playerScore) ));
          // //console.log('singlePlayerWinnigchips', singlePlayerWinnigchips);
          // singlePlayerWinnigchips  = parseInt(parseInt(singlePlayerWinnigchips) + parseInt(parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)));


          // //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
          // //console.log("room.players[i].playerScore", parseInt(room.players[i].playerScore));
          // //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
          // //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
          // //console.log("room.pointsValue", parseInt(room.pointsValue));
          // //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
          // //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
          // //console.log("singlePlayerWinnigchips2", singlePlayerWinnigchips);
          // //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
  				// // singlePlayerWinnigchips  = parseInt(singlePlayerWinnigchips) + (parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue));
  				// //console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.");
  				// //console.log("room.players[i].playerScore ->",room.players[i].playerScore);
          // //console.log("room.pointsValue ->",room.pointsValue);
  				// // //console.log("Sys.Config.Rummy.pointsValue ->",Sys.Config.Rummy.pointsValue);
  				// //console.log("singlePlayerWinnigchips ->",singlePlayerWinnigchips);
  				// //console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.");
  			}
  		}
      //console.log("##############################################################");
      //console.log("##############################################################");
      //console.log("playinPlayer", playinPlayer);
      //console.log("##############################################################");
      //console.log("##############################################################");
      // ~Commented on 24 Dec 2018 By K@y
      // reason: Extra amount is added to winning amount(as per Client Feedback)
      // if (room.maxPlayers == 6 && room.gameLosers.length > 0) {
      //   // add gamelooser's coin to winner
      //   for (var i = 0; i < room.gameLosers.length; i++) {
      //     singlePlayerWinnigchips  = parseInt(parseInt(singlePlayerWinnigchips) + parseInt(room.gameLosers[i].loss));
      //     //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      //     //console.log("singlePlayerWinnigchips3", singlePlayerWinnigchips);
      //     //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      //   }
      // }




  		if(playinPlayer != 1){
  			// get Winner from Declare Array

  			//console.log('------------------------------------------------')
  			//console.log('------Declare->',room.game.declare);
  			//console.log('------------------------------------------------')


  			for (let i=0; i < room.game.declare.length; i += 1) {
  				if(winnerPlayers.length == 0){
  					// for First Winner
  					let FirstWinner = room.getPlayerById(room.game.declare[i]);
            //console.log("11111111111111111111111111111111111111111111");
            //console.log("FirstWinner.username", FirstWinner.username);
            // TWENTYONE_CHANGE
            let valueCardScore = 0;
            if ( parseInt(FirstWinner.jokercardnumber) > 0) {
              valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+FirstWinner.jokercardnumber]);
              // //console.log("valueCardScore1", valueCardScore);
              // //console.log("FirstWinner.jokercardnumber", FirstWinner.jokercardnumber);
            }
            if ( parseInt(FirstWinner.uppercardnumber) > 0) {
              valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+FirstWinner.uppercardnumber]);
              // //console.log("valueCardScore1", valueCardScore);
              // //console.log("FirstWinner.uppercardnumber", FirstWinner.uppercardnumber);
            }
            if ( parseInt(FirstWinner.lowercardnumber) > 0) {
              valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+FirstWinner.lowercardnumber]);
              // //console.log("valueCardScore1", valueCardScore);
              // //console.log("FirstWinner.lowercardnumber", FirstWinner.lowercardnumber);
            }
            if ( parseInt(FirstWinner.marriageindex) > 0) {
              valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['marrigeScore_21_'+FirstWinner.marriageindex]);
              // //console.log("valueCardScore1", valueCardScore);
              // //console.log("FirstWinner.marriageindex", FirstWinner.marriageindex);
            }
            // if ( parseInt(FirstWinner.superioindex) > 0)) {
            //
            // }
            if ( parseInt(FirstWinner.valuecards) > 0) {
              valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy.valueCardScore_21 * FirstWinner.valuecards);
            }

            // valueCardScore = parseFloat(valueCardScore) * parseInt( parseInt(playinPlayer) - 1 );

  					winnerPlayers.push({
  						type            : 'winner',
  						playerId        : FirstWinner.id,
  						username        : FirstWinner.username,
  						won             : 0,                                          // Fainal Winning Chips Add here After All Calualation Done.
  						score           : parseInt(FirstWinner.playerScore),          // Fainal Loosing chips Add here.
  						tempScore       : parseInt(FirstWinner.playerScore),          // Fainal Loosing chips Add here.
              valueCardScore  : valueCardScore,                              // TWENTYONE_CHANGE
  						cards           : FirstWinner.cardsString,
  						points          : 0,                                          // For Pool / Deal
  						totalPoint      : 0,                                          // For Pool / Deal
  						dropped         : FirstWinner.dropped,
              wrongfinished   : FirstWinner.wrongfinished
  					});
  				}else{
  					let LosserPlayer = room.getPlayerById(room.game.declare[i]);
            // commented for // TWENTYONE_CHANGE
            winnerPlayers[0].won = (parseInt(winnerPlayers[0].won) + ( parseInt(LosserPlayer.playerScore) )).toString(); // Push Winner Amount.
            // //console.log("winnerPlayers[0].won", winnerPlayers[0].won);
            // winnerPlayers[0].won = (parseInt(winnerPlayers[0].won) + ( parseInt(LosserPlayer.playerScore) * parseInt(room.pointsValue))).toString(); // Push Winner Amount.




  					// winnerPlayers[0].won = parseInt(winnerPlayers[0].won) + ( parseInt(LosserPlayer.playerScore) * parseInt(Sys.Config.Rummy.pointsValue)); // Push Winner Amount.
  					// Cut Player Chips Here.
  					// let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(LosserPlayer.id);
            // let newChips = parseInt(playerObj.chips)-( parseInt(LosserPlayer.playerScore) * parseInt(room.pointsValue));
            // if ((parseInt(LosserPlayer.playerScore) * parseInt(room.pointsValue)) > playerObj.chips) {
            //   newChips = 0;
            // }
  					// // let newChips = parseInt(playerObj.chips)-( parseInt(LosserPlayer.playerScore) * parseInt(Sys.Config.Rummy.pointsValue));
  					// let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });
  					// Push Looser


  					// Deduct Player Chips
  					// let trnsObj = {
  					// 	playerId : playerObj.id,
            //   chips             : parseInt(2 * parseInt(room.pointsValue)),
  					// 	// chips             : parseInt(2 * parseInt(Sys.Config.Rummy.pointsValue)),
  					// 	cash            : 0,
  					// 	type              : 'debit',   //debit/credit
  					// 	tranType 			: 'chips',
  					// 	gameType : "points",
  					// 	tableType : "practice",
  					// 	message            : 'Game Lossing Chips',
  					// 	tableNumber            : room.tableNumber,
  					// 	transactionNumber : '',
  					// 	afterBalance      : newChips,
  					// 	status           : 'sucess',
  					// }
  					// let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);



  					//console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);

            // TWENTYONE_CHANGE
            //console.log("222222222222222222222222222222222222222222222222222");
            //console.log("LosserPlayer.username", LosserPlayer.username);
            //console.log("LosserPlayer.dropped", LosserPlayer.dropped);
            let valueCardScore = 0;
            if (LosserPlayer.dropped != true) {
              if ( parseInt(LosserPlayer.jokercardnumber) > 0) {
                valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+LosserPlayer.jokercardnumber]);
                // //console.log("valueCardScore2 looser jokercardnumber", valueCardScore);
              }
              if ( parseInt(LosserPlayer.uppercardnumber) > 0) {
                valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+LosserPlayer.uppercardnumber]);
                // //console.log("valueCardScore2 looser uppercardnumber", valueCardScore);
              }
              if ( parseInt(LosserPlayer.lowercardnumber) > 0) {
                valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+LosserPlayer.lowercardnumber]);
                // //console.log("valueCardScore2 looser lowercardnumber", valueCardScore);
              }
              if ( parseInt(LosserPlayer.marriageindex) > 0) {
                valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['marrigeScore_21_'+LosserPlayer.marriageindex]);
                // //console.log("valueCardScore2 looser marriageindex", valueCardScore);
              }
              // if ( parseInt(LosserPlayer.superioindex) > 0)) {
              //
              // }
              if ( parseInt(LosserPlayer.valuecards) > 0) {
                valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy.valueCardScore_21 * LosserPlayer.valuecards);
              }
            }



  					winnerPlayers.push({
  					type : 'loser',
  					playerId                 : LosserPlayer.id,
  					username                 : LosserPlayer.username,
            // won                      : 0,
            won                      : parseInt((parseInt(LosserPlayer.playerScore) ) * -1),      // TWENTYONE_CHANGE
            // won                      : parseInt((parseInt(LosserPlayer.playerScore) * parseInt(room.pointsValue)) * -1),      // TWENTYONE_CHANGE
  					score                    : parseInt(LosserPlayer.playerScore),
  					tempScore                : parseInt(LosserPlayer.playerScore),
            valueCardScore           : valueCardScore,                             // TWENTYONE_CHANGE
  					cards                    : LosserPlayer.cardsString,
  					points                   : 0,                                          // For Pool / Deal
  					totalPoint               : 0,                                          // For Pool / Deal
  					dropped                  : LosserPlayer.dropped,
            wrongfinished            : LosserPlayer.wrongfinished
  					});

  				}
          // if (parseInt(winnerPlayers[0].won) > 0) {
          //   // Deduct rac percentage from winning Amount
          //   let winningAmount = parseFloat(winnerPlayers[0].won);
          //   winnerPlayers[0].won   = parseInt( parseInt( parseInt( winnerPlayers[0].won ) * ( 100 - room.rack ) ) /100 );
          //   // winnerPlayers[0].won   = parseFloat( parseFloat( parseFloat( winnerPlayers[0].won ) * ( 100 - room.rack ) ) /100 );
          //   let adminCommissonAmount  = parseInt( parseInt( parseInt( winnerPlayers[0].won ) * room.rack ) /100 );
          //   // let adminCommissonAmount  = parseFloat( parseFloat( parseFloat( winnerPlayers[0].won ) * room.rack ) /100 );
          //   let updatedAdminCommission = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.createCommission({
          //     roomid                : room.id,
          //     gameType              : room.gameType,
          //     prizepool             : winningAmount,
          //     commissionAmount      : adminCommissonAmount,
          //     commissionPercentage  : room.rack,
          //     winnerAmount          : parseInt(winnerPlayers[0].won),
          //   });
          // }
  			}
        // //console.log("99999999999999999999999999999999999999999999999999999999999");
        // //console.log('parseInt(winnerPlayers[0].won)', parseInt(winnerPlayers[0].won));
        // if (parseInt(winnerPlayers[0].won) > 0) {
        //   // Deduct rac percentage from winning Amount
        //   let winningAmount = parseFloat(winnerPlayers[0].won);
        //   winnerPlayers[0].won   = parseInt( parseInt( parseInt( winnerPlayers[0].won ) * ( 100 - room.rack ) ) /100 );
        //   // winnerPlayers[0].won   = parseFloat( parseFloat( parseFloat( winnerPlayers[0].won ) * ( 100 - room.rack ) ) /100 );
        //   let adminCommissonAmount  = parseInt( parseInt( parseInt( winnerPlayers[0].won ) * room.rack ) /100 );
        //   // let adminCommissonAmount  = parseFloat( parseFloat( parseFloat( winnerPlayers[0].won ) * room.rack ) /100 );
        //   let updatedAdminCommission = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.createCommission({
        //     roomid                : room.id,
        //     gameType              : room.gameType,
        //     prizepool             : winningAmount,
        //     commissionAmount      : adminCommissonAmount,
        //     commissionPercentage  : room.rack,
        //     winnerAmount          : parseInt(winnerPlayers[0].won),
        //   });
        // }
  			//console.log('------------------------------------------------')
  			//console.log('------winnerPlayers->',winnerPlayers);
  			//console.log('------------------------------------------------')



  			for (let i=0; i < room.players.length; i += 1) {
  				if (room.game.declare.indexOf(room.players[i].id) == -1 && room.players[i].status != 'waiting' ) { // if Player not in Declare Array

  					//console.log('------------------------------------------------')
  					//console.log('------ID->',room.players[i].id);
  					//console.log('------winnerPlayers->',room.game.declare.indexOf(room.players[i].id));
  					//console.log('------------------------------------------------')

            winnerPlayers[0].won = parseInt(winnerPlayers[0].won) + (parseInt(room.players[i].playerScore) ); // Push Winner Amount. // TWENTYONE_CHANGE
            // //console.log("winnerPlayers[0].won", winnerPlayers[0].won);
            // winnerPlayers[0].won = parseInt(winnerPlayers[0].won) + (parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)); // Push Winner Amount. // TWENTYONE_CHANGE
  					// winnerPlayers[0].won = parseInt(winnerPlayers[0].won) + (parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue)); // Push Winner Amount.
  					// Cut Player Chips Here.
  					// let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(room.players[i].id);
            // let newChips = parseInt(playerObj.chips)-(parseInt(room.players[i].playerScore) * parseInt(room.pointsValue));
            // if ((parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)) > playerObj.chips) {
            //   newChips = 0;
            // }
  					// let newChips = parseInt(playerObj.chips)-(parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue));
  					// let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });


  					// Player Deduct Chips
  					// Deduct Player Chips
  					// let trnsObj = {
  					// 	playerId : playerObj.id,
            //   chips             : parseInt(room.players[i].playerScore) * parseInt(room.pointsValue),
  					// 	// chips             : parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue),
  					// 	cash            : 0,
  					// 	type              : 'debit',   //debit/credit
  					// 	tranType 			: 'chips',
  					// 	gameType : "points",
  					// 	tableType : "practice",
  					// 	message            : 'Game Loosing Chips',
  					// 	tableNumber            : room.tableNumber,
  					// 	transactionNumber : '',
  					// 	afterBalance      : newChips,
  					// 	status           : 'sucess',
  					// }
  					// let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);


  				 	 // Push Looser


               //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);

               // TWENTYONE_CHANGE
               //console.log("3333333333333333333333333333333333333333333333333333333333");
               //console.log("room.players[i].username", room.players[i].username);
               //console.log("room.players[i].dropped", room.players[i].dropped);
               // //console.log("###################################################");
               // //console.log("###################################################");
               // //console.log("###################################################");
               // //console.log("###################################################");
               //console.log("room.players", room.players[i]);
               let valueCardScore = 0;
               if (room.players[i].dropped != true) {
                 if ( parseInt(room.players[i].jokercardnumber) > 0) {
                   valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.players[i].jokercardnumber]);
                   // //console.log("valueCardScore3 looser jokercardnumber", valueCardScore);
                 }
                 if ( parseInt(room.players[i].uppercardnumber) > 0) {
                   valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.players[i].uppercardnumber]);
                   // //console.log("valueCardScore3 looser uppercardnumber", valueCardScore);
                 }
                 if ( parseInt(room.players[i].lowercardnumber) > 0) {
                   valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.players[i].lowercardnumber]);
                   // //console.log("valueCardScore3 looser lowercardnumber", valueCardScore);
                 }
                 if ( parseInt(room.players[i].marriageindex) > 0) {
                   valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['marrigeScore_21_'+room.players[i].marriageindex]);
                   // //console.log("valueCardScore3 looser marriageindex", valueCardScore);
                 }
                 // if ( parseInt(room.players[i].superioindex) > 0)) {
                 //
                 // }
                 if ( parseInt(room.players[i].valuecards) > 0) {
                   valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy.valueCardScore_21 * room.players[i].valuecards);
                 }
               }



      					winnerPlayers.push({
      						type              : 'loser',
      						playerId          : room.players[i].id,
      						username          : room.players[i].username,
                  // won               : 0,  // TWENTYONE_CHANGE
                  won               : parseInt((parseInt(room.players[i].playerScore) ) * -1),  // TWENTYONE_CHANGE
                  // won               : parseInt((parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)) * -1),  // TWENTYONE_CHANGE
      						score             : parseInt(room.players[i].playerScore),
      						tempScore         : parseInt(room.players[i].playerScore),
                  valueCardScore    : valueCardScore,                             // TWENTYONE_CHANGE
      						cards             : room.players[i].cardsString,
      						points            : 0, // For Pool / Deal
    							totalPoint        : 0,// For Pool / Deal
    							dropped           : room.players[i].dropped,
                  wrongfinished     : room.players[i].wrongfinished
      					});

  				}
  			}

        // TWENTYONE_CHANGE
        // if (parseInt(winnerPlayers[0].won) > 0) {
        //   // Deduct rac percentage from winning Amount
        //   let winningAmount = parseFloat(winnerPlayers[0].won);
        //   winnerPlayers[0].won   = parseInt( parseInt( parseInt( winnerPlayers[0].won ) * ( 100 - room.rack ) ) /100 );
        //   // winnerPlayers[0].won   = parseFloat( parseFloat( parseFloat( winnerPlayers[0].won ) * ( 100 - room.rack ) ) /100 );
        //   let adminCommissonAmount  = parseInt( parseInt( parseInt( winnerPlayers[0].won ) * room.rack ) /100 );
        //   // let adminCommissonAmount  = parseFloat( parseFloat( parseFloat( winnerPlayers[0].won ) * room.rack ) /100 );
        //   let updatedAdminCommission = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.createCommission({
        //     roomid                : room.id,
        //     gameType              : room.gameType,
        //     prizepool             : winningAmount,
        //     commissionAmount      : adminCommissonAmount,
        //     commissionPercentage  : room.rack,
        //     winnerAmount          : parseInt(winnerPlayers[0].won),
        //   });
        // }
  			//console.log('------------------------------------------------')
  			//console.log('------winnerPlayers After->',winnerPlayers);
  			//console.log('------------------------------------------------')

  			// Add Fainal Winer Chips To his Account
  			//winnerPlayers[0].won
  			// let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(winnerPlayers[0].playerId);
  			// let newChips = parseInt(playerObj.chips)+parseInt(winnerPlayers[0].won);
  			// let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(winnerPlayers[0].playerId,{ chips: newChips });


  			// add Player Chips
  			// let trnsObj = {
  			// 	playerId : playerObj.id,
  			// 	chips             : parseInt(winnerPlayers[0].won),
  			// 	cash            : 0,
  			// 	type              : 'credit',   //debit/credit
  			// 	tranType 			: 'chips',
  			// 	gameType : "points",
  			// 	tableType : "practice",
  			// 	message            : 'Game Winning Chips',
  			// 	tableNumber            : room.tableNumber,
  			// 	transactionNumber : '',
  			// 	afterBalance      : newChips,
  			// 	status           : 'sucess',
  			// }
  			// let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);

  		}else{ // when Single Player is Winner So Send All Chips to Single Player.

        // TWENTYONE_CHANGE
        // if (singlePlayerWinnigchips > 0) {
        //   // Deduct rac percentage from winning Amount
        //   let winningAmount = parseInt(singlePlayerWinnigchips);
        //   singlePlayerWinnigchips   = parseFloat( parseFloat( parseFloat( singlePlayerWinnigchips ) * ( 100 - room.rack ) ) /100 );
        //   let adminCommissonAmount  = parseFloat( parseFloat( parseFloat( singlePlayerWinnigchips ) * room.rack ) /100 );
        //   let updatedAdminCommission = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.createCommission({
        //     roomid                : room.id,
        //     gameType              : room.gameType,
        //     prizepool             : winningAmount,
        //     commissionAmount      : adminCommissonAmount,
        //     commissionPercentage  : room.rack,
        //     winnerAmount          : singlePlayerWinnigchips,
        //   });
        // }
        //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
        //console.log("singlePlayerWinnigchips4", singlePlayerWinnigchips);
        //console.log(":::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");

        // TWENTYONE_CHANGE
        //console.log("444444444444444444444444444444444444444444444444444444444444444");
        //console.log("winner.username", winner.username);
        let valueCardScore = 0;
          if ( parseInt(winner.jokercardnumber) > 0) {
            valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.jokercardnumber]);
            // //console.log("valueCardScore4 winner jokercardnumber", valueCardScore);
            // //console.log("winner.jokercardnumber", winner.jokercardnumber);
            // //console.log("parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.jokercardnumber])", parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.jokercardnumber]));
          }
          if ( parseInt(winner.uppercardnumber) > 0) {
            valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.uppercardnumber]);
            // //console.log("valueCardScore4 winner uppercardnumber", valueCardScore);
            // //console.log("winner.uppercardnumber", winner.uppercardnumber);
            // //console.log("parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.uppercardnumber])", parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.uppercardnumber]));
          }
          if ( parseInt(winner.lowercardnumber) > 0) {
            valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.lowercardnumber]);
            // //console.log("valueCardScore4 winner lowercardnumber", valueCardScore);
            // //console.log("winner.lowercardnumber", winner.lowercardnumber);
            // //console.log("parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.lowercardnumber])", parseFloat(Sys.Config.Rummy['cardScore_21_'+winner.lowercardnumber]));
          }
          if ( parseInt(winner.marriageindex) > 0) {
            valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['marrigeScore_21_'+winner.marriageindex]);
            // //console.log("valueCardScore4 winner marriageindex", valueCardScore);
            // //console.log("winner.marriageindex", winner.marriageindex);
            // //console.log("parseFloat(Sys.Config.Rummy['marrigeScore_24_'+winner.marriageindex])", parseFloat(Sys.Config.Rummy['marrigeScore_21_'+winner.marriageindex]));
          }
          // if ( parseInt(winner.superioindex) > 0)) {
          //
          // }
          if ( parseInt(winner.valuecards) > 0) {
            valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy.valueCardScore_21 * winner.valuecards);
          }


  			winnerPlayers.push({
  				type            : 'winner',
  				playerId        : winner.id,
  				username        : winner.username,
          // won             : 0,                                          // TWENTYONE_CHANGE
  				won             : parseInt(singlePlayerWinnigchips),          // TWENTYONE_CHANGE
  				score           : 0,
  				tempScore       : 0,
          valueCardScore  : valueCardScore,                             // TWENTYONE_CHANGE
  				cards           : winner.cardsString,
  				points          : 0,                                          // For Pool / Deal
  				totalPoint      : 0,                                          // For Pool / Deal
  				dropped         : winner.dropped,
          wrongfinished   : winner.wrongfinished
  			});
        //console.log("9999999999999999999999999999999999999999999999999999999999");
        //console.log("winnerPlayers", winnerPlayers);
        //console.log("9999999999999999999999999999999999999999999999999999999999");
  			// Add Seingle Winner Chips
  			// let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(winner.id);
  			// let newChips = parseInt(playerObj.chips)+parseInt(singlePlayerWinnigchips) ;
  			// let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(winner.id,{ chips: newChips });

  			// add Player Chips
  			// let trnsObj = {
  			// 	playerId : playerObj.id,
  			// 	chips             : parseInt(singlePlayerWinnigchips),
  			// 	cash            : 0,
  			// 	type              : 'credit',   //debit/credit
  			// 	tranType 			: 'chips',
  			// 	gameType 			: "points",
  			// 	tableType			 : "practice",
  			// 	message            : 'Game Winning Chips',
  			// 	tableNumber            : room.tableNumber,
  			// 	transactionNumber : '',
  			// 	afterBalance      : newChips,
  			// 	status           : 'sucess',
  			// }
  			// let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);



  			// Push Loser
  			for (let i=0; i < room.players.length; i += 1) {
  				if ( winner.id != room.players[i].id && room.players[i].status != 'waiting' ) {

  					// Cut Player Chips Here.
  					let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(room.players[i].id);
            // let newChips = parseInt(playerObj.chips) - ( parseInt(room.players[i].playerScore) * parseInt(room.pointsValue));
            // if ((parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)) > playerObj.chips) {
            //   newChips = 0;
            // }
  					// let newChips = playerObj.chips - ( parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue));
  					// let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });

  					// Deduct Player Chips
  					// let trnsObj = {
  					// 	playerId : playerObj.id,
            //   chips             : parseInt(room.players[i].playerScore) * parseInt(room.pointsValue),
  					// 	// chips             : parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue),
  					// 	cash              : 0,
  					// 	type              : 'debit',   //debit/credit
  					// 	tranType 			    : 'chips',
  					// 	gameType          : "points",
  					// 	tableType         : "practice",
  					// 	message           : 'Game Loosing Chips',
  					// 	tableNumber       : room.tableNumber,
  					// 	transactionNumber : '',
  					// 	afterBalance      : newChips,
  					// 	status            : 'sucess',
  					// }
  					// let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);


            //  Left Player Score

             // //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);


             // TWENTYONE_CHANGE
             //console.log("55555555555555555555555555555555555555555555555555555555555");
             //console.log("room.players[i]..username", room.players[i].username);
             //console.log("room.players[i]..dropped", room.players[i].dropped);
             let valueCardScore = 0;
             if (room.players[i].dropped != true) {
               if ( parseInt(room.players[i].jokercardnumber) > 0) {
                 valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.players[i].jokercardnumber]);
                 // //console.log("valueCardScore5 looser jokercardnumber", valueCardScore);
               }
               if ( parseInt(room.players[i].uppercardnumber) > 0) {
                 valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.players[i].uppercardnumber]);
                 // //console.log("valueCardScore5 looser uppercardnumber", valueCardScore);
               }
               if ( parseInt(room.players[i].lowercardnumber) > 0) {
                 valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.players[i].lowercardnumber]);
                 // //console.log("valueCardScore5 looser lowercardnumber", valueCardScore);
               }
               if ( parseInt(room.players[i].marriageindex) > 0) {
                 valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['marrigeScore_21_'+room.players[i].marriageindex]);
                 // //console.log("valueCardScore5 looser marriageindex", valueCardScore);
               }
               // if ( parseInt(room.players[i].superioindex) > 0)) {
               //
               // }
               if ( parseInt(room.players[i].valuecards) > 0) {
                 valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy.valueCardScore_21 * room.players[i].valuecards);
               }
             }




             // Push Looser
  					winnerPlayers.push({
  						type              : 'loser',
  						playerId          : room.players[i].id,
  						username          : room.players[i].username,
              // won               : 0,
              won               : parseInt((parseInt(room.players[i].playerScore) ) * -1),
              // won               : parseInt((parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)) * -1),
  						score             : parseInt(room.players[i].playerScore),
  						tempScore         : parseInt(room.players[i].playerScore),
              valueCardScore    : valueCardScore,                             // TWENTYONE_CHANGE
  						cards             : room.players[i].cardsString,
  						points            : 0,                                          // For Pool / Deal
  						totalPoint        : 0,                                          // For Pool / Deal
  						dropped           : room.players[i].dropped,
              wrongfinished     : room.players[i].wrongfinished
  					});
  				}
  			}
        if (room.maxPlayers == 6 && room.gameLosers.length > 0) {
          for (var i = 0; i < room.gameLosers.length; i++) {
            // Push game loosers to the winnerPlayer array
            // Push Looser who left the room and rejoined the same room
            let plrObj = false;
            for (var j = 0; j < winnerPlayers.length; j++) {
              if (winnerPlayers[j].playerId == room.gameLosers[i].id) {
                plrObj = true;
              }
            }
            if (plrObj == false) {

              // TWENTYONE_CHANGE
              //console.log("666666666666666666666666666666666666666666666666666666666666");
              //console.log("room.gameLosers[i].username", room.gameLosers[i].username);
              //console.log("room.gameLosers[i].dropped", room.gameLosers[i].dropped);
              let valueCardScore = 0;
              if (room.gameLosers[i].dropped != true) {
                if ( parseInt(room.gameLosers[i].jokercardnumber) > 0) {
                  valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.gameLosers[i].jokercardnumber]);
                  // //console.log("valueCardScore6 looser jokercardnumber", valueCardScore);
                }
                if ( parseInt(room.gameLosers[i].uppercardnumber) > 0) {
                  valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.gameLosers[i].uppercardnumber]);
                  // //console.log("valueCardScore6 looser uppercardnumber", valueCardScore);
                }
                if ( parseInt(room.gameLosers[i].lowercardnumber) > 0) {
                  valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['cardScore_21_'+room.gameLosers[i].lowercardnumber]);
                  // //console.log("valueCardScore6 looser lowercardnumber", valueCardScore);
                }
                if ( parseInt(room.gameLosers[i].marriageindex) > 0) {
                  valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy['marrigeScore_21_'+room.gameLosers[i].marriageindex]);
                  // //console.log("valueCardScore6 looser marriageindex", valueCardScore);
                }
                // if ( parseInt(room.gameLosers[i].superioindex) > 0)) {
                //
                // }
                if ( parseInt(room.gameLosers[i].valuecards) > 0) {
                  valueCardScore = parseFloat(valueCardScore) + parseFloat(Sys.Config.Rummy.valueCardScore_21 * room.gameLosers[i].valuecards);
                }
              }

              winnerPlayers.push({
                type              : 'loser',
                playerId          : room.gameLosers[i].id,
                username          : room.gameLosers[i].username,
                // won               : 0,                                          // TWENTYONE_CHANGE
                won               : parseInt(parseInt(room.gameLosers[i].loss) * -1),
                score             : parseInt(room.gameLosers[i].score),
                tempScore         : parseInt(room.gameLosers[i].score),
                valueCardScore    : valueCardScore,                             // TWENTYONE_CHANGE
                cards             : room.gameLosers[i].cards,
                points            : 0,                                          // For Pool / Deal
                totalPoint        : 0,                                          // For Pool / Deal
                dropped           : room.gameLosers[i].dropped,
                wrongfinished     : room.gameLosers[i].wrongfinished
              });
            }
          }
        }


  		}

  		////console.log('Winner :',winnerPlayers);
  		//console.log('<=> Game Finished Called || GAME-NUMBER [] ||');
  		roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);



  		let totalPlayers = 0;
  		for (i = 0; i < room.players.length; i++) {

  			// Save Player  History
  			room.game.players.push(room.players[i]);

  			if(room.players[i].status != 'Left' && room.players[i].dropped != true){
  				totalPlayers++;
  			}
  		}


  		// Save Winner History

      //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      //console.log("playinPlayer other than me ", parseInt( parseInt(totalPlayers) - 1) );
      //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");

      // if in the first turn flayer finish and declare so making score half
      if (room.getPlayerById(winnerPlayers[0].playerId).turnCount == 2) {
        firstTurnFinished = true;
        let newWinningAmount = 0;
        let match = 0;
        for (var i = 0; i < room.players.length; i++) {
          for (var j = 0; j < winnerPlayers.length; j++) {
						// 			//console.log('newWinningAmount--', newWinningAmount)
						// 			//console.log('??????????????????????????????????????')
						// //console.log('??????????????????????????????????????')
            if(room.players[i].turnCount == 1){
							match ++;
							//console.log('winnerPlayers[j].type', winnerPlayers[j].type)
                if (room.players[i].id == winnerPlayers[j].playerId) {
                  // winnerPlayers[j].score = winnerPlayers[j].tempScore;
                  winnerPlayers[j].score  = parseFloat( winnerPlayers[j].tempScore / 2 );
                  winnerPlayers[j].won    = parseFloat( winnerPlayers[j].won / 2 );
									newWinningAmount        = parseFloat(newWinningAmount) + parseFloat(winnerPlayers[j].won);
									//console.log('newWinningAmount 1st turn', newWinningAmount)
                }
            }else {
                if (room.players[i].id == winnerPlayers[j].playerId) {
                  newWinningAmount        = parseFloat(newWinningAmount) + parseFloat(winnerPlayers[j].won);
									//console.log('newWinningAmount', newWinningAmount)
                }
            }
						// //console.log('??????????????????????????????????????')
						// //console.log('??????????????????????????????????????')
          }
        }
      }


      // TWENTYONE_CHANGE
      let opponentValueScore = 0;
      for (var j = 0; j < winnerPlayers.length; j++) {
          opponentValueScore = parseFloat(opponentValueScore) + parseFloat(winnerPlayers[j].valueCardScore);
      }

      // TWENTYONE_CHANGE
      // //console.log("555555555555555555555555555555555555555555555555555555555555");
      // //console.log("555555555555555555555555555555555555555555555555555555555555");
      // //console.log("555555555555555555555555555555555555555555555555555555555555");
      // //console.log("winnerPlayers", winnerPlayers);
      // //console.log("555555555555555555555555555555555555555555555555555555555555");
      // //console.log("555555555555555555555555555555555555555555555555555555555555");
      // //console.log("555555555555555555555555555555555555555555555555555555555555");
      for (var k = 0; k < winnerPlayers.length; k++) {
        if (winnerPlayers[k].type == 'winner') {
          room.game.winners.push(winnerPlayers[k])
          let LosserPlayer = room.getPlayerById(winnerPlayers[k].playerId);

          // //console.log("Sys.Config.Rummy.cardScore_21_+''+room.players[i].jokercardnumber", Sys.Config.Rummy['cardScore_21_'+LosserPlayer.jokercardnumber]);
          // //console.log("Sys.Config.Rummy.cardScore_21_+''+room.players[i].uppercardnumber", Sys.Config.Rummy['cardScore_21_'+LosserPlayer.uppercardnumber]);
          // //console.log("Sys.Config.Rummy.cardScore_21_+''+room.players[i].lowercardnumber", Sys.Config.Rummy['cardScore_21_'+LosserPlayer.lowercardnumber]);
          // //console.log("Sys.Config.Rummy.marrigeScore_21_+''+room.players[i].marriageindex", Sys.Config.Rummy['cardScore_21_'+LosserPlayer.marriageindex]);
          // Credit winner Chips
          let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(winnerPlayers[k].playerId);
          // TWENTYONE_CHANGE

          let myOpponentValueScore = parseFloat( ( parseFloat(opponentValueScore) - parseFloat(winnerPlayers[k].valueCardScore) ) * (-1) );

          let playerWonAmount = 0;
          let credit = 0;
          //console.log("parseFloat(myOpponentValueScore)", parseFloat(myOpponentValueScore));
          //console.log("parseFloat(winnerPlayers[k].valueCardScore)", parseFloat(winnerPlayers[k].valueCardScore));
          //console.log("parseFloat(winnerPlayers[k].valueCardScore.won)", parseFloat(winnerPlayers[k].won));
          //console.log("Winner Values--------------------------------------------------------------------");
          //console.log("playerObj.chips", parseFloat(playerObj.chips));
          //console.log("parseFloat(winnerPlayers[k].valueCardScore.won)", parseFloat(winnerPlayers[k].won));
          // if (parseInt( parseInt(totalPlayers) -1) == 0 ) {
          //   playerWonAmount = parseFloat(myOpponentValueScore) + parseFloat( parseFloat(winnerPlayers[k].valueCardScore) ) + parseFloat(winnerPlayers[k].won);
          //   credit = parseFloat( parseFloat(winnerPlayers[k].valueCardScore) );
          // }else {
            playerWonAmount = parseFloat(myOpponentValueScore) + parseFloat( parseFloat(winnerPlayers[k].valueCardScore) * parseInt( parseInt(totalPlayers) -1) ) + parseFloat(winnerPlayers[k].won);
            credit = parseFloat( parseFloat(winnerPlayers[k].valueCardScore) * parseInt( parseInt(totalPlayers) -1) );
          // }
          //console.log("playerWonAmount", playerWonAmount);
          // //console.log("winnerPlayers[k].playerId", winnerPlayers[k].playerId);
          // //console.log("winnerPlayers[k].playerId", winnerPlayers[k].playerId);
          winnerPlayers[k].credit = parseFloat(credit);
          winnerPlayers[k].debit = parseFloat(myOpponentValueScore);
          winnerPlayers[k].won = parseFloat(parseFloat(playerWonAmount) * parseFloat(room.pointsValue));
          // winnerPlayers[k].won = parseFloat(playerWonAmount);
          let newChips = parseFloat(playerObj.chips) + parseFloat(winnerPlayers[k].won);
          let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });

          // Create transaction entry for chips transaction
    			let trnsObj = {
    				playerId          : playerObj.id,
            gameId            : room.game.id,
    				chips             : parseInt(winnerPlayers[k].won),
    				cash              : 0,
    				type              : 'credit',   //debit/credit
    				tranType 			    : 'chips',
    				gameType 			    : "practice_points21",
    				tableType			    : "practice",
    				message           : 'Game Winning Chips',
    				tableNumber       : room.tableNumber,
    				transactionNumber : '',
    				afterBalance      : newChips,
    				status            : 'sucess',
    			}
    			let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);
          //

        }else {
          room.game.losers.push(winnerPlayers[k])

          // Deduct Looser Chips
          let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(winnerPlayers[k].playerId);
          let LosserPlayer = room.getPlayerById(winnerPlayers[k].playerId);

          // TWENTYONE_CHANGE

          let myOpponentValueScore = parseFloat( ( parseFloat(opponentValueScore) - parseFloat(winnerPlayers[k].valueCardScore) ) * (-1) );

          let playerWonAmount = 0;
          // //console.log("==========================================================");
          // //console.log("==========================================================");
          // //console.log("==========================================================");
          // //console.log("==========================================================");
          // //console.log("==================Looser Score Sheet======================");
          // //console.log("player->username", winnerPlayers[k].username);
          // //console.log("winnerPlayers[k].dropped", winnerPlayers[k].dropped);
          // //console.log("parseFloat(myOpponentValueScore)", parseFloat(myOpponentValueScore));
          // //console.log("parseFloat(winnerPlayers[k].valueCardScore)", parseFloat(winnerPlayers[k].valueCardScore));
          // //console.log("parseFloat(winnerPlayers[k].valueCardScore.won)", parseFloat(winnerPlayers[k].won));
          // //console.log("==================Looser Score Sheet======================");
          // //console.log("==========================================================");
          // //console.log("==========================================================");
          // //console.log("==========================================================");
          // //console.log("==========================================================");
          if (winnerPlayers[k].dropped == true) {
            playerWonAmount = parseFloat(winnerPlayers[k].won)
          }else {
            if (parseInt( parseInt(totalPlayers) -1) == 0 ) {
              playerWonAmount = parseFloat( parseFloat(winnerPlayers[k].valueCardScore) ) + parseFloat(winnerPlayers[k].won);
              // playerWonAmount = parseFloat(myOpponentValueScore) + parseFloat( parseFloat(winnerPlayers[k].valueCardScore) ) + parseFloat(winnerPlayers[k].won);
              credit = parseFloat( parseFloat(winnerPlayers[k].valueCardScore) );
            }else {
                playerWonAmount = parseFloat(myOpponentValueScore) + parseFloat( parseFloat(winnerPlayers[k].valueCardScore) * parseInt( parseInt(totalPlayers) -1) ) + parseFloat(winnerPlayers[k].won);
                credit = parseFloat( parseFloat(winnerPlayers[k].valueCardScore) * parseInt( parseInt(totalPlayers) -1) );
            }
          }
          //console.log("parseFloat(winnerPlayers[k].valueCardScore.won) after dropped value", parseFloat(winnerPlayers[k].won));

          //console.log("playerWonAmount", playerWonAmount);

          // //console.log("winnerPlayers[k].playerId", winnerPlayers[k].playerId);
          // //console.log("winnerPlayers[k].playerId", winnerPlayers[k].playerId);
          if (winnerPlayers[k].dropped != true ) {
            //console.log("Dropped is false");
            winnerPlayers[k].credit = parseFloat(credit);
            winnerPlayers[k].debit = parseFloat(myOpponentValueScore);
            // winnerPlayers[k].won = parseFloat(parseFloat(playerWonAmount) * parseFloat(room.pointsValue));
            // winnerPlayers[k].won = parseFloat(playerWonAmount);
          }else {
            //console.log("Dropped is true");
            winnerPlayers[k].credit = 0;
            winnerPlayers[k].debit = 0;
            // if (LosserPlayer.turnCount < 4) {
            // winnerPlayers[k].won = parseFloat(parseFloat(winnerPlayers[k].valueCardScore) * parseFloat(room.pointsValue));
            // winnerPlayers[k].won = parseFloat(parseFloat(playerWonAmount) * parseFloat(room.pointsValue));
            // }else {
            // winnerPlayers[k].won = parseFloat(winnerPlayers[k].won);
            // }
          }

          winnerPlayers[k].won = parseFloat(parseFloat(playerWonAmount) * parseFloat(room.pointsValue));

          //console.log("parseFloat(winnerPlayers[k].valueCardScore.won) after pointvalue value", parseFloat(winnerPlayers[k].won));

          let newChips = 0;
          if (LosserPlayer && LosserPlayer.status != 'Left') {
            newChips = parseInt(playerObj.chips) + parseInt(winnerPlayers[k].won);
            if (parseInt(winnerPlayers[k].won) > playerObj.chips) {
              newChips = 0;
            }
            let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });
          }



          // Create transaction entry for chips transaction
          let trnsObj = {
          	playerId          : playerObj.id,
            gameId            : room.game.id,
            chips             : (parseInt(winnerPlayers[k].won) * (-1)),
          	// chips             : parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue),
          	cash              : 0,
          	type              : 'debit',   //debit/credit
          	tranType 			    : 'chips',
          	gameType          : "practice_points21",
          	tableType         : "practice",
          	message           : 'Game Loosing Chips',
          	tableNumber       : room.tableNumber,
          	transactionNumber : '',
          	afterBalance      : newChips,
          	status            : 'sucess',
          }
          let chipsTransection = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.cerateChipsCashHistory(trnsObj);
          //
        }
      }
  		// winnerPlayers.forEach( async function (wp){
  		// 	if(wp.type == 'winner'){
  		//
  		// 	}else{
  		//
  		// 	}
  		// })

  		let timer = (!Sys.Config.Rummy.waitBeforeGameRestart ? 30 : Sys.Config.Rummy.waitBeforeGameRestart);
     		//  //console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  		// //console.log('timer  : ',timer );
  		// //console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  		room.timerStart = true;

  		//console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  		//console.log('>>>>>> winnerPlayers ->  : ',winnerPlayers );
  		//console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  		roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

  		Sys.Timers[room.id] = setInterval(async function(room){
  			//console.log("Practice Points21 Fainal Game Finsihed Timer ",timer)

        // if in the first turn flayer finish and declare so making score half
        // if (room.getPlayerById(winnerPlayers[0].playerId).turnCount == 2) {
        //   let match = 0;
        //   for (var i = 0; i < room.players.length; i++) {
        //     if(room.players[i].turnCount == 1){
        //       match ++;
        //     }
        //   }
        //
        //   if ((match+1) == room.players.length) {
        //     for (var i = 0; i < winnerPlayers.length; i++) {
        //       winnerPlayers[i].score = parseInt( winnerPlayers[i].score / 2 );
        //     }
        //   }
        // }

  			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnGameFinished', {
  				 	winners: winnerPlayers,
  					timer : timer,
  				 	maxTimer : Sys.Config.Rummy.waitBeforeGameRestart,
  				 	type : room.tableType
  			});

  			timer--;
  			if(timer < 1){
  				room.timerStart = true;

  				clearTimeout(Sys.Timers[room.id]); // Clear waitforDeclare
  				//console.log("Check For Start New Round");
  				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnGameRestart', {});
  				for (i = 0; i < room.players.length; i++) {
  					if(room.players[i].status != 'Left'){
  							room.players[i].dropped = false;
  							room.players[i].cards = [];
  							room.players[i].cardsString = '';
  							room.players[i].playerScore = 0;
  							room.players[i].cardTurn = true;
  							room.players[i].timerPosition = 1;
  							room.players[i].declare = false;
  							room.players[i].extraTime = Sys.Config.Rummy.extraTime;
  							room.players[i].turnCount = 1;

  					}
  				}
  				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
  				timer = parseInt(Sys.Config.Rummy.waitBeforeGameStart);
  				Sys.Timers[room.id] = setInterval(async function(room){
  					timer--;
  					//console.log("Wait For Restart : ",timer)
  					await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnGameStartWait', {
  						roomId: room.id,
  						timer : timer,
  						maxTimer :  parseInt(Sys.Config.Rummy.waitBeforeGameStart)
  					});


  						if(timer == 1 || timer == 2 ){
  							totalPlayers = 0;
  							for (i = 0; i < room.players.length; i++) {
  								if(room.players[i].status != 'Left'){
  									totalPlayers++;
  								}
  							}
  							//room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);
  						}

  					if(timer < 1){

  						    room.timerStart = false; // Reset Timer Variable
  							clearTimeout(Sys.Timers[room.id]); // Clear Room Timer

                for (var i = 0; i < room.players.length; i++) {
                  let player = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(room.players[i].id);
                  //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
                  //console.log("Checking the balance of players so to remove bankrupt");
                  //console.log("room.players[i].chips", player.cash);
                  //console.log("parseFloat( parseFloat(room.pointsValue)*120 )", parseFloat( parseFloat(room.pointsValue)*120 ));
                  if (parseFloat(player.chips) < parseFloat( parseFloat( parseFloat(room.pointsValue)*480 ) )) {
                    //console.log(" Removed room.players[i].id", player.username);
                    // room.players[i].status = 'Left';
                    let playerData = {
            					playerId : player.id,
            					roomId : room.id
            				}
                    //console.log("PlayerData", playerData);
                    await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.leaveRoom(playerData);
            				// await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.leaveRoom(playerData);

                    //Save History
            				let dataObj = {
            					playerId:player.id,
            					action: 'Left Player or Indufficient Cash',
            					card : '',
            					cardString : '',
            					time : Date.now()
            				}
            				room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);

                  }
                }

  							//room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);

  							roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

  							totalPlayers = 0;
  							for (i = 0; i < room.players.length; i++) {
  								if(room.players[i].status != 'Left'){
  									totalPlayers++;
  								}
  							}

  							room.status = "Finished";
  							room.game = null;
  							room.dealer = 0;
  							room.currentPlayer = 0;


  							//console.log('<===============================>');
  							//console.log('<=> Ramain Player : <=>',totalPlayers);
  							//console.log('<===============================>');


  							//room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);

  							if(totalPlayers >= room.minPlayers){
  								//console.log('<===============================>');
  								//console.log('<=> New Game Starting [] <=>');
  								//console.log('<===============================>');
  								room.StartGame();
  							}else{
  							    // Remove Player Which Have Status Left
  								for (let i = 0; i < room.players.length; i++) {
  									if (room.players[i].status == 'Left') {
  										room.players.splice(i, 1);
  									}
  								}

  								room.status = "waiting";
  								room.game = null;
  								roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
  								//console.log('<===============================>');
  								//console.log('<=> Not Minimum Player Found So Game not Starting ');
  								//console.log('<===============================>');
  							}

  					}
  				}, 1000, room);


  			}
  		}, 1000, room);
  	}else{
  		//console.log('<=> Game Finished Called By Game is Already Finished ||');
  	}

  	}catch (error) {
  		Sys.Log.info('Error in gameFinished : ' + error);
  		return new Error('Error in gameFinished');

  	}
	},
	pushOpenDeck: async function(data) {
		try{
      //console.log('<=> Game Player pushOpenDeck Action || :',data);
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
      // //console.log('<=> Game Player pushOpenDeck Action || :');
			// //console.log('<=> Game Player pushOpenDeck Action || :');
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
			if (!room) {
				return {
					status: 'fail',
					result: null,
					message: "Room not found",
					statusCode: 401
				};
			}
			if (room.status != 'Running') {
				return new Error('Game Finished. Please Try Again!');
			}

			var currentPlayer = room.getCurrentPlayer();
			//console.log("Current Palyer :",currentPlayer.username);
			if (currentPlayer && (currentPlayer.id != data.playerId)) {
        //console.log('Its not your turn or your turn expired');
				return new Error('Its not your turn or your turn expired');
			}

			currentPlayer.droppedCount = 0;  // When Play Do Some Turn

			clearTimeout(Sys.Timers[room.id]); // Clear Turn Timer


			//console.log("room.game.status->",room.game.status);
      //console.log("data.card", data.card);
      let  playercards = currentPlayer.cards.length;
			if (room.game.status == 'Running') {
				room.game.openDeck.push(data.card); // Push card to OpenDeck
				//console.log("Change turn");

				for(let i = 0; i < currentPlayer.cards.length ; i++){
					if(currentPlayer.cards[i] == data.card){
            //console.log("Match Found");
            //console.log("===========================================================");
            //console.log("==================Card is removed while pushOpenDeck========================");
            //console.log("===========================================================");
						currentPlayer.cards.splice(i,1);
            break;
					}
				}

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

				await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.changeTurn(room);
				//console.log("Room Save");

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);
				//console.log("PushOpenDeck Brodcast Send");
				let broObj = {
					playerId : data.playerId,
					card: data.card
				}
        await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PushOpenDeck',broObj);
				//console.log("Turn Finished Called");

				//Save History
				let dataObj = {
					playerId:currentPlayer.id,
					action: 'Push Open Deck',
					card : data.card,
					cardString : '',
					time : Date.now()
				}
				room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);

				await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.turnFinished(room);
        return;

			} else {
				return new Error('Game is not running');
			}
		}catch (error) {
			Sys.Log.info('Error in pushOpenDeck : ' + error);
			return new Error('Error in pushOpenDeck');
		}
	},
	getOpenDeckList: async function(data) {
		try{
			//console.log('<=> Game Player pushOpenDeck Action || :',data);
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
			if (!room) {
				return {
					status: 'fail',
					result: null,
					message: "Room not found",
					statusCode: 401
				};
			}
			return {
				status: 'success',
				result: room.game.openDeck,
				message: "Open Deck List",
				statusCode: 401
			};

		}catch (error) {
			Sys.Log.info('Error in pushOpenDeck : ' + error);
			return new Error('Error in pushOpenDeck');
		}
	},
	popOpenDeck: async function(data) {
		try{
			//console.log('<=> Game Player popOpenDeck Action || :',data);
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
			if (!room) {
				return {status: 'fail',	result: null,message: "Room not found",statusCode: 401};
			}
			if (room.status != 'Running') {
				return new Error('Game Finished. Please Try Again!');
			}
			var currentPlayer = room.getCurrentPlayer();

			if (currentPlayer && (currentPlayer.id != data.playerId)) {
				return new Error('Its not your turn or your turn expired');
			}


			if(currentPlayer.cardTurn == true){
				//console.log("Card Turn Already Done.")
				return new Error('Card Turn Already Done.');
			}

			//console.log("room.game.status->",room.game.status);
			if (room.game.status == 'Running') {
        if(room.game.history.length > 1 && room.game.openDeck[room.game.openDeck.length-1] == 'PJ'){
				// if(room.game.openDeck.length !=1 && room.game.history.length < 1 && room.game.openDeck[room.game.openDeck.length-1] == 'PJ'){
          //console.log("It is Joker Card So You Can Not Pick");
					return new Error('It is Joker Card So You Can Not Pick');
				}
        if(room.game.history.length > 1 && room.game.openDeck[room.game.openDeck.length-1].length == 3){
        // if(room.game.openDeck.length !=1 && room.game.history.length < 1 && room.game.openDeck[room.game.openDeck.length-1].length == 3){
          //console.log("It is Joker Card So You Can Not Pick");
					return new Error('It is Joker Card So You Can Not Pick');
				}
				data.card = room.game.openDeck.pop(); // Move Card From open Deck to Player Cards
				currentPlayer.cards.push(data.card); //
				currentPlayer.cardTurn = true; // Card Turn Done
				//console.log("Room Save");

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

				//console.log("popOpenDeck Brodcast Send");
				let broObj = {
					playerId : data.playerId,
					card: data.card,
					openDeckCard : (room.game.openDeck[room.game.openDeck.length-1] == undefined) ? ""  : room.game.openDeck[room.game.openDeck.length-1],

				}
				//console.log("broObj->",broObj);
				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PopOpenDeck',broObj);
				//Save History
				let dataObj = {
					playerId:currentPlayer.id,
					action: 'Pop Open Deck',
					card : data.card,
					cardString : '',
					time : Date.now()
				}
				room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);
        return ;
			} else {
				return new Error('Game is not running');
			}
		}catch (error) {
			Sys.Log.info('Error in popOpenDeck : ' + error);
			return new Error('Error in popOpenDeck');
		}
	},
	popCloseDeck: async function(data) {
		try{
			let i = 0;
		//console.log('<=> Game Player popCloseDeck Action || :',data);
		let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);

		if (!room) {
			return {
				status: 'fail',
				result: null,
				message: "Room not found",
				statusCode: 401
			};
		}
		if (room.status != 'Running') {
			return new Error('Game Finished. Please Try Again!');
		}
		var currentPlayer = room.getCurrentPlayer();
			//console.log("Pop Close Deck Current Palyer :",currentPlayer.username);
		if (currentPlayer && (currentPlayer.id != data.playerId)) {
			return new Error('Its not your turn or your turn expired');
		}

		if(currentPlayer.cardTurn == true){
			//console.log("Card Turn Already Done.")
			return new Error('Card Turn Already Done.');
		}

		//console.log("room.game.status->",room.game.status);
		 // await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('CloseDeckCardsRefill',{});


		if (room.game.status == 'Running') {
			//console.log("Close Deck Length : ",room.game.closeDeck.length);
			if(room.game.closeDeck.length == 0){
				//console.log("All Close Deck Card Finished!");

				//Shuffle the deck array with Fisher-Yates
				let i, j, tempi, tempj;
				for (i = 0; i < room.game.openDeck.length; i += 1) {
					j = Math.floor(Math.random() * (i + 1));
					tempi = room.game.openDeck[i];
					tempj = room.game.openDeck[j];
					room.game.openDeck[i] = tempj;
					room.game.openDeck[j] = tempi;
				}

				for(i=0;i<room.game.openDeck.length - 1;i++){
					room.game.closeDeck.push(room.game.openDeck[i]); // Move Cards Form Open Deck To Close Deck
				}

				//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
				//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
				//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
				//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
				//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");

				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('CloseDeckCardsRefill',{});
			}


			data.card = room.game.closeDeck.pop(); // Move Card From open Deck to Player Cards

			currentPlayer.cards.push(data.card); //
			currentPlayer.cardTurn = true; // Card Turn Done
			//console.log("Room Save");

			roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);



			//console.log("popCloseDeck Brodcast Send");
			let broObj = {
				playerId : data.playerId,
				card: data.card
			}
			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PopCloseDeck',broObj);

			//Save History
			let dataObj = {
				playerId:currentPlayer.id,
				action: 'Pop Close Deck',
				card : data.card,
				cardString : '',
				time : Date.now()
			}
			room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);
      return ;

		} else {
			return new Error('Game is not running');
		}
		}catch (error) {
			Sys.Log.info('Error in popCloseDeck : ' + error);
			return new Error('Error in popCloseDeck');
		}
	},
	playerDrop: async function(data) {
		try{
			//console.log("playerDrop Data", data);
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);

			if (!room) {

				//console.log('<=> Removing Player Room Not Found');
				return {
					status: 'fail',
					result: null,
					message: "Room Not Found",
					statusCode: 401
				};
			}
			if (room.status != 'Running') {
				return new Error('Game Finished. Please Try Again!');
			}
			 let currentPlayer = room.getCurrentPlayer()
				if (currentPlayer && (currentPlayer.id != data.playerId)) {
					return new Error('Its not your turn or your turn expired');
				}




			if (room.players.length > 0) {
				for (let i = 0; i < room.players.length; i++) {
					if (room.players[i].id == data.playerId && room.players[i].status != 'Left') {

						room.players[i].dropped = true;
            //console.log();
            //console.log("======================================================");
            //console.log("======================================================");
            //console.log("room.players[i].turnCount", room.players[i].turnCount);
            //console.log("======================================================");
            //console.log("======================================================");
						if(room.players[i].turnCount == 2 || room.players[i].turnCount == 1){
              //console.log("First and second turn");
							room.players[i].playerScore = Sys.Config.Rummy.playerFirstDrop_21;
						}else if(room.players[i].turnCount == 3){
              //console.log("Third turn");
							room.players[i].playerScore = Sys.Config.Rummy.playerSecondDrop_21;
						}else{
              //console.log("Above third turn");
              //console.log('Sys.Config.Rummy.playerThirdDrop', Sys.Config.Rummy.playerThirdDrop_21);
							room.players[i].playerScore = Sys.Config.Rummy.playerThirdDrop_21;
						}
            //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].username);
						//console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);
            //console.log("666666666666666666666666666666666666666666666666666666611");
            //console.log("666666666666666666666666666666666666666666666666666666611");
            //console.log("Player Dopped due To Declarer Timer",room.players[i].playerScore);
						break;
					}
				}
			}
			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerDrop', { 'playerId': data.playerId });

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room); // Update Player

				//room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.broadcastPlayerInfo(room);
				room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.checkTurnFinished(room,data.playerId);

			  	// Save History
				let dataObj = {
					playerId:currentPlayer.id,
					action: 'Player Drop',
					card : '',
					cardString : '',
					time : Date.now()
				}
				room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);


				return {
					status: 'success',
					message: "Player Droped success",
					statusCode: 200
				};

		}catch (error) {
			Sys.Log.info('Error in playerDrop : ' + error);
			return new Error('Error in playerDrop');
		}
	},
	playerCardsScore: async function(data) {
		try{
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);

			if (!room) {
				return {
					status: 'fail',
					result: null,
					message: "Room not found",
					statusCode: 401
				};
			}
			if (room.status != 'Running') {
				return new Error('Game Finished. Please Try Again!');
			}

      // //console.log("data", data);
			for (let i=0; i < room.players.length; i += 1) {
        if (room.players[i].id == data.playerId) {
				// if (room.players[i].id == data.playerId && room.players[i].dropped == false) {
					// //console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>",room.players[i].username);
					// //console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",data.pointValue);
					// room.players[i].playerScore       = parseInt(data.pointValue); // Player Cards Sum
					// room.players[i].cardsString       = data.cardsString;
          // TWENTYONE_CHANGE
          if (data.jokercardnumber) {
            room.players[i].jokercardnumber   = parseInt(data.jokercardnumber);
          }
          if (data.uppercardnumber) {
            room.players[i].uppercardnumber   = parseInt(data.uppercardnumber);
          }
          if (data.lowercardnumber) {
            room.players[i].lowercardnumber   = parseInt(data.lowercardnumber);
          }
          if (data.marriageindex) {
            room.players[i].marriageindex     = parseInt(data.marriageindex);
          }
          if (data.superioindex) {
            room.players[i].superioindex      = parseInt(data.superioindex);
          }
          if (data.valuecards) {
            room.players[i].valuecards        = parseInt(data.valuecards);
          }

          if (data.jokercardnumber && data.uppercardnumber && data.lowercardnumber && data.marriageindex && data.superioindex && data.valuecards) {
            room.players[i].playerScore       = parseInt(data.pointValue); // Player Cards Sum
          }
          // //console.log("room.player.jokercardnumber", room.players[i].jokercardnumber);
					break;
				}
			}
			roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

			return {
				status: 'sucess',
				result:  data.pointValue,
				message: "Socre Updated",
				statusCode: 200
			};
		}catch (error) {
			Sys.Log.info('Error in playerCardsScore : ' + error);
			return new Error('Error in playerCardsScore');
		}
	},

  playerTableCards: async function(data) {
		try{
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);

			if (!room) {
				return {
					status: 'fail',
					result: null,
					message: "Room not found",
					statusCode: 401
				};
			}
			if (room.status != 'Running') {
				return new Error('Game Finished. Please Try Again!');
			}


			for (let i=0; i < room.players.length; i += 1) {
				if (room.players[i].id == data.playerId && room.players[i].dropped == false) {
					// //console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>",room.players[i].username);
					// //console.log("->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",data.pointValue);
					// room.players[i].playerScore       = data.pointValue; // Player Cards Sum
					room.players[i].cardsString       = data.cardsString;
          // TWENTYONE_CHANGE
          // room.players[i].jokercardnumber   = data.jokercardnumber;
          // room.players[i].uppercardnumber   = data.uppercardnumber;
          // room.players[i].lowercardnumber   = data.lowercardnumber;
          // room.players[i].marriageindex     = data.marriageindex;
          // room.players[i].superioindex      = data.superioindex;
          // room.players[i].valuecards        = data.valuecards;
					break;
				}
			}
			roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

			return {
				status: 'sucess',
				result:  data.pointValue,
				message: "Socre Updated",
				statusCode: 200
			};
		}catch (error) {
			Sys.Log.info('Error in playerCardsScore : ' + error);
			return new Error('Error in playerCardsScore');
		}
	},

	declarefinishGame: async function(data) {
		try{
      //console.log("===========================================================");
      //console.log("==================Declare Game called======================");
      //console.log("===========================================================");
			//console.log('<=> Game Player finishGame Action || :',data);
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
		if (!room) {
			return {
				status: 'fail',
				result: null,
				message: "Room not found",
				statusCode: 401
			};
		}
		if (room.status != 'Running') {
			return new Error('Game Finished. Please Try Again!');
		}
		var currentPlayer = room.getCurrentPlayer();
		////console.log("Current Palyer :",currentPlayer);
		if (currentPlayer && (currentPlayer.id != data.playerId)) {
			return new Error('Its not your turn or your turn expired');
		}


		//console.log("room.game.status->",room.game.status);
		if (room.game.status == 'Running') {
			room.game.finishDeck.push(data.card); // Push card to OpenDeck
			//console.log("Change turn");

			// Save History
			let dataObj = {
				playerId:currentPlayer.id,
				action: 'Player Finishe Game',
				card : data.card,
				cardString : '',
				time : Date.now()
			}
			room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);


			for(let i = 0; i < currentPlayer.cards.length ; i++){
				if(currentPlayer.cards[i] == data.card){
          //console.log("===========================================================");
          //console.log("==================Card is removed while Declare========================");
          //console.log("===========================================================");
					currentPlayer.cards.splice(i,1);
          break;
				}
			}

			let broObj = {
				playerId : data.playerId,
				card: data.card
			}
			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PushFinishDeck',broObj);
			roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

			// Start Finish Timer
			clearTimeout(Sys.Timers[room.id]);

			let timer = 45;
			Sys.Timers[room.id] = setInterval(async function(room){
				//console.log("Finish timer",timer)
				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnFinishTimer', {
					roomId: room.id,
					timer : timer,
					playerId : data.playerId,
					finishName : currentPlayer.username,
					maxTimer : 45
				});
				timer--;

				if(timer == 0){
					clearTimeout(Sys.Timers[room.id]); // Clear waitforDeclare

					// Player Not Declare With in Timer So Drop Theme.
					if (room.players.length > 0) {
						for (let i = 0; i < room.players.length; i++) {
							if (room.players[i].id == data.playerId && room.players[i].status != 'Left') {
                // //console.log("66666666666666666666666666666666666666666666666");
                // //console.log("Finish Game", room.players);
                // //console.log("66666666666666666666666666666666666666666666666");
								room.players[i].dropped = true;
								// room.players[i].playerScore =  120;                             // TWENTYONE_CHANGE

                if(room.players[i].turnCount == 2  || room.players[i].turnCount == 1 ){
                  room.players[i].playerScore = Sys.Config.Rummy.playerFirstDrop_21;
                }else if(room.players[i].turnCount == 3){
                  room.players[i].playerScore = Sys.Config.Rummy.playerSecondDrop_21;
                }else{
                  room.players[i].playerScore = Sys.Config.Rummy.playerThirdDrop_21;
                }
                //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].username);
    						//console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);
                //console.log("666666666666666666666666666666666666666666666666666666622");
                //console.log("666666666666666666666666666666666666666666666666666666622");
                //console.log("Player Dopped due To Declarer Timer",room.players[i].playerScore);
								break;
							}
						}
					}
					await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerDrop', { 'playerId': data.playerId });

					roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room); // Update Player
					room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.checkTurnFinished(room,data.playerId);


				}
			}, 1000, room);



		} else {
			return new Error('Game is not running');
		}
		}catch (error) {
			Sys.Log.info('Error in declarefinishGame : ' + error);
			return new Error('Error in declarefinishGame');
		}
	},
	declareGame: async function(data) {
		try{
			let i = 0;
		//console.log('<=> Game Player declareGame Action || :',data);
		let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
		if (!room) {
			return {
				status: 'fail',
				result: null,
				message: "Room not found",
				statusCode: 401
			};
		}
		if (room.status != 'Running') {
			return new Error('Game Finished. Please Try Again!');
		}
    // //console.log("66666666666666666666666666666666666666666666666");
    // //console.log("Declare Game", room.players);
    // //console.log("66666666666666666666666666666666666666666666666");
		var currentPlayer = room.getCurrentPlayer();
		//console.log("room.game.declare.length :",room.game.declare.length);
		if (currentPlayer && (currentPlayer.id != data.playerId) &&  room.game.declare.length == 0) {
      //console.log('Its not your turn For Declare');
			return new Error('Its not your turn For Declare');
		}

		//console.log("room.game.status->",room.game.status);
		if (room.game.status == 'Running') {
			// When Current Player Declare
			if(currentPlayer.id == data.playerId){

			// Save History
			let dataObj = {
				playerId:currentPlayer.id,
				action: 'Player Declare Game',
				card : '',
				cardString : currentPlayer.cardsString,
				time : Date.now()
			}
			room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);


				//console.log("currentPlayer.playerScore ++++++++++>",currentPlayer.playerScore);


				// //console.log("=====================================");
				// //console.log("=====================================");
				// //console.log("currentPlayer.playerScore ++++++++++>",currentPlayer.playerScore);
				// currentPlayer.playerScore = 0;
				// //console.log("=====================================");
				// //console.log("=====================================");

					if(currentPlayer.playerScore == 0){

						clearTimeout(Sys.Timers[room.id]); // Clear waitforFinshDeclareDeclare

						//console.log('Game Finsihed Declare Player');
						currentPlayer.declare = true;
						room.game.declare.push(data.playerId);
						roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room); // Update room

						if(room.game.declare.length == 1){ // if Some one Already declare so not call declare
							room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.waitForGameDeclare(room,data.playerId);
						}


						return {
							status: 'success',
							message: "Player Declare success",
							statusCode: 200
						};

					}else{
						//console.log('Droped Player');
						await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('CloseFinishTimer', {});
						currentPlayer.dropped = true;
						// currentPlayer.playerScore = 120;

            if(currentPlayer.turnCount == 2  || currentPlayer.turnCount == 1 ){
              currentPlayer.playerScore = Sys.Config.Rummy.playerFirstDrop_21;
            }else if(currentPlayer.turnCount == 3){
              currentPlayer.playerScore = Sys.Config.Rummy.playerSecondDrop_21;
            }else{
              currentPlayer.playerScore = Sys.Config.Rummy.playerThirdDrop_21;
            }
            if (data.wrongfinished) {
              currentPlayer.wrongfinished = data.wrongfinished;
              currentPlayer.playerScore = 120;
            }
            //console.log("Player Drop  playerScore ----------------->>>>>>",currentPlayer.username);
            //console.log("Player Drop  playerScore ----------------->>>>>>",currentPlayer.playerScore);
            //console.log("666666666666666666666666666666666666666666666666666666633");
            //console.log("666666666666666666666666666666666666666666666666666666633");
            //console.log("Player Dopped due To Declarer Timer",currentPlayer.playerScore);


						// Save History
						let dataObj = {
							playerId:currentPlayer.id,
							action: 'Player Wrong Declare Drop',
							card : '',
							cardString : currentPlayer.cardsString,
							time : Date.now()
						}
						room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);

						clearTimeout(Sys.Timers[room.id]); // Clear waitforDeclare
						//console.log("After CurrentPlayer  PlayerScore ++++++++++>",currentPlayer.playerScore);

						await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerDrop', { 'playerId': data.playerId });

						roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room); // Update Player


						room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.checkTurnFinished(room,data.playerId);


						return {
							status: 'success',
							message: "Player Droped success",
							statusCode: 200
						};

					}




			}else{
			// Other Player Decalre


				for (i = 0; i < room.players.length; i++) {
					if (room.players[i].id == data.playerId && room.players[i].status != 'Left') {
							// Save History
							let dataObj = {
								playerId:data.playerId,
								action: 'Player Declare',
								card : '',
								cardString : room.players[i].cardsString,
								time : Date.now()
							}
							room = await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.saveHistory(room,dataObj);

						room.players[i].declare = true;
						break;
					}
				}




				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room); // Update Player

				// check If All Player Declare
				let allDeclare = true;

				for (i = 0; i < room.players.length; i++) {
					if (room.players[i].declare == false &&  room.players[i].dropped == false && room.players[i].status == 'playing') {
						allDeclare = false;
					}
				}
				//console.log("All Player Declare :",allDeclare);
				if(allDeclare){
					clearTimeout(Sys.Timers[room.id]); // Clear waitforDeclare
					room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.gameFinished(room);
				}


				return {
					status: 'success',
					message: "Player Declare success",
					statusCode: 200
				};

			}
		} else {
			return new Error('Game is not running');
		}

		}catch (error) {
			Sys.Log.info('Error in declareGame : ' + error);
			return new Error('Error in declareGame');
		}
	},
	leaveRoom: async function(data) {
		try{
			////console.log("LeftRoom Data", data);
			if (!data.roomId) {
				//console.log('<=> Removing Player RoomID Not Found');
				return {
					status: 'fail',
					result: null,
					message: "Room Not Found",
					statusCode: 401
				};
			}
			let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
			if (!room) {
				//console.log('<=> Removing Player Room Not Found');
				return {
					status: 'fail',
					result: null,
					message: "Room Not Found",
					statusCode: 401
				};
			}
			//console.log('<=> LeftRoom Called || GAME-NUMBER [] || Data : ',data);
			//check for user already present //
			// chek seat in players array
			let player = null;
			let playerId = 0;
			let removePlayer = false; // When Player Status is 'sitting' Or 'waiting' So Left Player From Room;
			if (room.players.length > 0 && data.playerId != undefined ) {
				for (let i = 0; i < room.players.length; i++) {
					if (room.players[i].id == data.playerId && room.players[i].status != 'Left') {

						if(room.players[i].status == 'sitting' || room.players[i].status == 'waiting'){
							removePlayer = true;
						}

						player = room.players[i];
						room.players[i].status = 'Left';
            // TWENTYONE_CHANGE
            if (room.players[i].dropped == false) {
              if(room.players[i].turnCount == 2  || room.players[i].turnCount == 1 ){
                room.players[i].playerScore = Sys.Config.Rummy.playerFirstDrop_21;
              }else if(room.players[i].turnCount == 3){
                room.players[i].playerScore = Sys.Config.Rummy.playerSecondDrop_21;
              }else{
                room.players[i].playerScore = Sys.Config.Rummy.playerThirdDrop_21;
              }
            }
            //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].username);
            //console.log("Player Drop  playerScore ----------------->>>>>>",room.players[i].playerScore);
            //console.log("666666666666666666666666666666666666666666666666666666644");
            //console.log("666666666666666666666666666666666666666666666666666666644");
            room.players[i].dropped = true;


						playerId = room.players[i].id;

						// Push Player in Looser Array.
						// This is Code For Testing Loser Array.
            //console.log("**********************************************************");
            //console.log("**********************************************************");
            //console.log("room.status", room.status);
            //console.log("**********************************************************");
            //console.log("**********************************************************");
						if(room.status == "Running"){
              let playerObj = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.getById(room.players[i].id);
              let newChips = parseInt(playerObj.chips)-( parseInt(room.players[i].playerScore) * parseInt(room.pointsValue));
              if (( parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)) > playerObj.chips) {
                newChips = 0;
              }
  						// let newChips = parseInt(playerObj.chips)-( parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue));
  						let updatedPlayer = await Sys.Game.Practice.PointsTwentyOne.Services.PlayerServices.update(playerObj.id,{ chips: newChips });
  						room.gameLosers.push({
  							id : room.players[i].id,
  							username :room.players[i].username,
  							score : parseInt(room.players[i].playerScore),
  							cards : room.players[i].cardsString,
                loss : parseInt(parseInt(room.players[i].playerScore) * parseInt(room.pointsValue)),
                // loss : parseInt(parseInt(room.players[i].playerScore) * parseInt(Sys.Config.Rummy.pointsValue)),
  							dropped : room.players[i].dropped
  						})
            }
						break;
					}
				}
			}
			if (player) {
				//console.log('<=> Removing Player || GAME-NUMBER [] ||');

				if (room.game && room.game.status == 'Running') {
					//console.log('<=> Game PlayerLeft Broadcast || GAME-NUMBER [] || PlayerLeft : ',player.username);
					room  =  await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.checkTurnFinished(room,playerId);
				}

				// Remove Palyer From room

				roomUpdated = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room); // Update Player

				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('PlayerLeft', { 'playerId': player.id });

				//console.log('Final Remove Player ');
				// Cut Player Chips

				if(removePlayer){
					for (let i = 0; i < room.players.length; i++) {
						if (room.players[i].status == 'Left' && room.players[i].id == playerId) {
							room.players.splice(i, 1);
						}
					}
				}

        let activePlayerCount = 0;
        for (var i = 0; i < room.players.length; i++) {
          if (room.players[i].status != "Left") {
            activePlayerCount ++;
          }
        }
        //console.log("***********************************************************");
        //console.log("activePlayerCount", activePlayerCount);
        //console.log("room.minPlayers", room.minPlayers);
        //console.log("***********************************************************");
        if (activePlayerCount < room.minPlayers) {
		        room.game = null;
		}
		if (activePlayerCount == 0 ) {

			clearTimeout(Sys.Timers[room.id]);
			room.timerStart = false;
			room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.update(room);

		}
			return {
				status: 'success',
				message: "Player Leave success",
				statusCode: 200
			};

			} else {
				return {
					status: 'fail',
					result: null,
					message: "Player not found",
					statusCode: 401
				};
			}
		}catch (error) {
			Sys.Log.info('Error in leaveRoom : ' + error);
			return new Error('Error in leaveRoom');
		}
	},
	saveHistory: async function(room,data) {
		if(room.game){
			room.game.history.push(data);
		}
	  return room;
	},
	waitForGameDeclare: async function(room,playerId) {
		try {
  		clearTimeout(Sys.Timers[room.id]);

  		let timer = parseInt(Sys.Config.Rummy.declareTimer);
  		Sys.Timers[room.id] = setInterval(async function(room){
  			//console.log("Declare timer",timer)
  			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(room.id).emit('OnDeclareTimer', {
  				roomId: room.id,
  				timer : timer,
  				playerId : playerId,
  				maxTimer : Sys.Config.Rummy.declareTimer
  			});
  			timer--;
  			if(timer == 0){
  				clearTimeout(Sys.Timers[room.id]);// Clear waitforDeclare
  				await Sys.Game.Practice.PointsTwentyOne.Controllers.RoomProcess.gameFinished(room);
  			}
  		}, 1000, room);
  	}catch (error) {
  		Sys.Log.info('Error in waitForGameDeclare : ' + error);
  		return new Error('Error in waitForGameDeclare');

  	}

	},
	findGame: async function(data){
        try {
            Sys.Log.info('<=> Check findGame || ');
	        let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
			if (!room) {
                return { status: 'fail',result: null,message: "Room not found",	statusCode: 401	};
			}
			// check Room running Stataus
			// if(room.status != 'Running'){
			// 	return { status: 'fail',result: null,message: "Room Not Running",	statusCode: 401	};
			// }
			// check Player Avilabe in Room
			let palyeravilable = false;
			for (let i = 0; i < room.players.length; i++) {
				if ( room.players[i].id == data.playerId && room.players[i].status != 'Left' ) {
						palyeravilable = true;
						break
				}
			}
			if(!palyeravilable){
				return { status: 'fail',result: null,message: "Player Not Found!",	statusCode: 401	};
			}
		   return room;
        }catch (error) {
			Sys.Log.info('Error in findGame : ' + error);
			return new Error('Error in findGame');
        }
	},
	// reconnectGame: async function(socket,data){
  //       try {
  //           Sys.Log.info('<=> Check reconnectGame || ');
	//         let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
	// 		if (!room) {
  //               return { status: 'fail',result: null,message: "Room not found",	statusCode: 401	};
	// 		}
	// 		// check Room running Stataus
	// 		// if(room.status != 'Running'){
	// 		// 	return { status: 'fail',result: null,message: "Room Not Running",	statusCode: 401	};
	// 		// }
	// 		// check Player Avilabe in Room
	// 		let palyeravilable = false;
	// 		for (let i = 0; i < room.players.length; i++) {
	// 			if ( room.players[i].id == data.playerId && room.players[i].status != 'Left' ) {
	// 				palyeravilable = true;
	// 				break
	// 			}
	// 		}
	// 		if(!palyeravilable){
	// 			return { status: 'fail',result: null,message: "Player Not Found!",	statusCode: 401	};
	// 		}
  //
  //
  //
	// 		// if(room.game && room.game.status == 'Running'){
	// 			// Send Room Joker Cards & OpneDeck Card information
  //       let isPrintedJoker  = false;
  //       let jokerCard       = room.game.jokerCard[0];
  //       if (room.game.jokerCard[0] == 'PJ') {
  //         isPrintedJoker  = true;
  //         jokerCard       = 'AS';
  //       }
  //       let joObj = {
  //         upperJoker2     : '',
  //         upperJoker1     : room.game.upperJoker[0],
  //         lowerJoker2     : '',
  //         lowerJoker1     : room.game.lowerJoker[0],
  //         jokerCard       : jokerCard,
  //         OpenCard        : room.game.openDeck[room.game.openDeck.length-1],
  //         isPrintedJoker  : isPrintedJoker
  //       }
	// 			//console.log("joObj->",joObj);
	// 			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('JokerOpenCardInfo', joObj);
  //
  //
	// 			room.players.forEach(async function (player) {
	// 				let playerCards = {
	// 					playerId : player.id,
	// 					cards : player.cards,
	// 				};
	// 				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('ReconnectPlayerDeck', playerCards);
	// 			});
	// 			await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('TurnPlayer', {
	// 				playerId: room.getCurrentPlayer().id
	// 			});
	// 		// }
  //
	// 	   return room;
  //       }catch (error) {
	// 		Sys.Log.info('Error in findGame : ' + error);
	// 		return new Error('Error in findGame');
  //       }
	// },

  reconnectGame: async function(socket,data){
        try {

            Sys.Log.info('<=> Check reconnectGame || ');
            Sys.Log.info('<=> Check reconnectGame || ');
            Sys.Log.info('<=> Check reconnectGame || ');
            Sys.Log.info('<=> Check reconnectGame || ');
            Sys.Log.info('<=> Check reconnectGame || ');
            Sys.Log.info('<=> Check reconnectGame || ');
					let room = await Sys.Game.Practice.PointsTwentyOne.Services.RoomServices.get(data.roomId);
					// //console.log("ROOOOM",room)
			if (!room) {
                return { status: 'fail',result: null,message: "Room not found",	statusCode: 401	};
			}
			// check Room running Stataus
			// if(room.status != 'Running'){
			// 	return { status: 'fail',result: null,message: "Room Not Running",	statusCode: 401	};
			// }
			// check Player Avilabe in Room
			let palyeravilable = false;
			for (let i = 0; i < room.players.length; i++) {
				if ( room.players[i].id == data.playerId && room.players[i].status != 'Left' ) {
					palyeravilable = true;
					break
				}
			}
			if(!palyeravilable){
				return { status: 'fail',result: null,message: "Player Not Found!",	statusCode: 401	};
			}


			//console.log("GAME ID:",room.game.id);
			// if(room.game && room.game.status == 'Running'){
				// Send Room Joker Cards & OpneDeck Card information
        let isPrintedJoker  = false;
        let jokerCard       = room.game.jokerCard[0];
        if (room.game.jokerCard[0] == 'PJ') {
          isPrintedJoker  = true;
          jokerCard       = 'AS';
        }
        let joObj = {
          upperJoker2     : '',
          upperJoker1     : room.game.upperJoker[0],
          lowerJoker2     : '',
          lowerJoker1     : room.game.lowerJoker[0],
          jokerCard       : jokerCard,
          OpenCard        : room.game.openDeck[room.game.openDeck.length-1],
					isPrintedJoker  : isPrintedJoker,
					isReJoin				: true
        }
				//console.log("joObj->",joObj);


				room.players.forEach(async function (player) {
					if (player.turnCount < 2 && player.id == data.playerId) {
						let	timer = parseInt(Sys.Config.Rummy.waitBeforeGameStart);
					await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('OnGameStartWait', {
						roomId: room.id,
						timer : timer,
						maxTimer :  parseInt(Sys.Config.Rummy.waitBeforeGameStart)
					});
					}
				});


				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('JokerOpenCardInfo', joObj);
				// //console.log("JOCKER CARD INFO ",joObj);

				room.players.forEach(async function (player) {
					let playerCards = {
						playerId : player.id,
						cards : player.cards,
					};
					// //console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
					// //console.log("COUNTTURN",player.turnCount);
					// //console.log("GAME ID:",room.game.id);
					// //console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
					if(room.status=='Running' && player.id == data.playerId )
					{
						if ( player.turnCount < 2 ) {
							//console.log("PLAYER TURN COUNT111",player.turnCount);
							//console.log("player.username111",player.username);
							//console.log("PlayerDeck111",playerCards)
							await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('PlayerDeck', playerCards);
						} else {
							//console.log("PLAYER TURN COUNT222",player.turnCount);
							//console.log("player.username222",player.username);
							if (player.turnCount==2) {
							await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('PlayerDeck', playerCards);
								//console.log("PLAYER DECK DATA",playerCards);
							}
							await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('ReconnectPlayerDeck', playerCards);
							//console.log("ReconnectPlayerDeck222",playerCards)
						}
					}

				});
				await Sys.Io.of(Sys.Config.Namespace.PracticePointsTwentyOne).to(socket.id).emit('TurnPlayer', {
					playerId: room.getCurrentPlayer().id
				});
			// }

		   return room;
        }catch (error) {
			Sys.Log.info('Error in findGame : ' + error);
			return new Error('Error in findGame');
        }
	}



}
