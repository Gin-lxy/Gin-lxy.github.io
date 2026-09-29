---
title: "EBU5213 Internet protocols and networks"
date: 2024-03-16 18:56:00
permalink: "2024/03/16/大二下EBU5213 Internet protocols and networks/"
tags: ["计算机网络"]
categories: ["本科"]
---

# 第一章 计算机网络和因特网

## Introduction of IP Networks

![计算机网络和因特网示意图](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_1.png)  
数以亿计的计算设备被称为:主机(host)或端系统(end system)  
端系统通过通信链路（communication link）和分组交换机（packet switch）连接到一起。  
不同的链路能够以不同的速率传输数据，链路的传输速率（transmission rate）以比特/秒（bit/s或bps）度量。  
mesh of interconnected routers  
当一台端系统要向另一台端系统发送数据时，发送端系统将数据分段，并为每段加上首部字节。由此形成的信息包用计算机网络的术语来说称为分组（packet）。  
packet-switching: hosts break application-layer messages into packets.

*   forward packetsfrom one router to the next, across links on path from source to destination.
*   each packet transmitted at full link capacity.

两种最著名的分组交换机是路由器（router）和链路层交换机（link-layer switch）。这两种类型的交换机朝着最终目的地转发分组。链路层交换机通常用于接入网中，而路由器通常用于网络核心中。从发送端系统到接收端系统，一个分组所经历的一系列通信链路和分组交换机称为通过该网络的路径（mute或path）。  
各因特网服务提供商(（Internet Service Provider, ISP)为端系统提供了各种不同类型的网络接入，包括如线缆调制解调器或 DSL 那样的住宅宽带接入、高速局域网接入和移动无线接人。ISP也为内容提供者提供因特网接入服务，将Web 站点和视频服务器直接连入因特网。  
TCP(Transmission Control Protocol，传输控制协议)和IP(Intemet Protocol，网际协议)是因特网中两个最为重要的协议。IP 协议定义了在路由器和端系统之间发送和接收的分组格式。因特网的主要协议统称为TCP/IP。  
协议（protocol）定义了在两个或多个通信实体之间交换的报文的格式和顺 序，以及报文发送和/或接收一条报文或其他事件所采取的动作。  
端系统也称为主机(host),主机有时又被进一步划分为两类：客户 （client）和服务器（server）  
边缘路由器是端系统到任何其他 远程端系统的路径上的第一台路由器。  
电缆调制解调器端接系统（Cable Modem Termination System, CMTS）与DSL网络的DSLAM具有类 似的功能，即将来自许多下行家庭中的电缆调制解调器发送的模拟信号转换回数字形式。电缆调制解调器将HFC网络划分为下行和上行两个信道。如同DSL,接入通常是不对称的，下行信道分配的传输速率通常比上行信道的高。  
store and forward(存储转发): entire packet must arrive at router before it can be transmitted on next link.

## 分组交换

为了从源端系统向目的端系统发送一个报文(message)，源将长报文划分为较小的数据块，称之为分组 (packet)。在源和目的地之间，每个分组都通过通信链路和分组交换机（packet switch ） 传送。（交换机主要有两类：路由器（router）和链路层交换机（link-layer\* switch）。  
分组以等于该链路最大传输速率的速度传输通过通信链路。

### 排队时延和分组丢失

每台分组交换机有多条链路与之相连。对于每条相连的链路，该分组交换机具有一个  
输出缓存（output buffer,也称为输出队列（output queue））,它用于存储路由器准备发往 那条链路的分组。该输出缓存在分组交换中起着重要的作用。如果到达的分组需要传输到 某条链路，但发现该链路正忙于传输其他分组，该到达分组必须在输出缓存中等待。因此，除了存储转发时延以外，分组还要承受输岀缓存的排队时延（queuing delay）。这些时  
延是变化的，变化的程度取决于网络的拥塞程度。因为缓存空间的大小是有限的，一个到 达的分组可能发现该缓存已被其他等待传输的分组完全充满了。在此情况下，将出现分组  
丢失（丢包）（packet loss）,到达的分组或已经排队的分组之一将被丢弃。  
queuing and loss:

*   if arrival rate (in bits) to link exceeds transmission rate of link for a period of time:
*   packets will queue, wait to be transmitted on link
*   packets can be dropped (lost) if memory (buffer) fills up  
    routing(路由): determines source-destination route taken by packets  
    forwarding(转发):move packets from router’s input to appropriate router output

### 电路交换

在电路交换网络中，在端系统间通信会话期间，预留了端系统间沿路径通信所需要的 资源（缓存，链路传输速率）。在分组交换网络中，这些资源则不是预留的；会话的报文按需使用这些资源，其后果可能是不得不等待（即排队）接入通信线路  
**频分复用 时分复用?**

### Internet structure: network of networks

*   End systems connect to Internet via access ISPs (Internet Service Providers)  
    residential, company and university ISPs
*   Access ISPs in turn must be interconnected.  
    so that any two hosts can send packets to each other
*   Resulting network of networks is very complex  
    evolution was driven by economics and national policies
*   Let’s take a stepwise approach to describe current Internet structure  
    接入ISP被认为是客户（customer）,而全球传输ISP被认为是提供商(provider) 。  
    沿着这些相同路线，第三方公司 能够创建一个因特网交换点(Internet Exchange Point, TXP) , IXF是一个汇合点，多个ISP 能够在这里一起对等![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_1.png)

### 分组交换网中的时延概述

时延最为重要的是节点处理时延(nodal processing delay) 排队时延(queuing delay)、传输时延 (transmission delay)和传播时延(propagation delay),这些时延总体累加起来是节点总时 延(tolal nodal delay)。

#### 时延的类型

路由器A检查 该分组的首部以决定它的适当岀链路， 并将该分组导向该链路。在这个例子 中，对该分组的出链路是通向路由器 B的那条链路。仅当在该链路没有其 他分组正在传输并且没有其他分组排 在该队列前面时，才能在这条链路上  
传输该分组；如果该链路当前正繁忙或有其他分组已经在该链路上排队，则新到达的分组 将加入排队。

(1)处理时延  
检查分组首部和决定将该分组导向何处所需要的时间  
dproc: nodal processing  
check bit errors  
determine output link  
typically < msec  
(2)排队时延  
在队列中，当分组在链路上等待传输时，它经受排队时延  
dqueue: queueing delay  
time waiting at output link for transmission  
depends on congestion level of router  
(3)传输时延  
假定分组以先到先服务方式传输——这在分组交换网中是常见的方式，仅当所有已经 到达的分组被传输后，才能传输刚到达的分组。用厶比特表示该分组的长度，用R bps (即b/s)表示从路由器A到路由器B的链路传输速率。  
dtrans: transmission delay:  
L: packet length (bits)  
R: link bandwidth (bps)  
dtrans = L/R  
(4)传播时延  
一旦一个比特被推向链路，该比特需要向路由器B传播。从该链路的起点到路由器B 传播所需要的时间是传播时延。  
dprop: propagation delay:  
d: length of physical link  
s: propagation speed (~2x108 m/sec)  
dprop = d/s

**dtrans and dprop very different**  
传输时延是路由器推出分组所需要的时间，它是分组长度和链路传输速率的函 数，而与两台路由器之间的距离无关。另一方面，传播时延是一个比特从一台路由器传播 到另一台路由器所需要的时间，它是两台路由器之间距离的函数，而与分组长度或链路传 输速率无关。

### 排队时延和丢包

#### Packet loss

*   queue (aka buffer) preceding link in buffer has finite capacity
*   packet arriving to full queue dropped (aka lost)
*   lost packet may be retransmitted by previous node, by source end system, or not at all

#### Throughput(吞吐量)

throughput:rate (bits/time unit) at which bits transferred between sender/receiver

*   instantaneous:rate at given point in time
*   average:rate over longer period of time

我们要问该服务器到客户的吞吐量是多少？  
这台服务器不能以快于Rc bps的速率通过其链路注 入比特；这台路由器也不能以快于汕bps的速率转发比特。如果Rc < Rs。则在给定的吞吐量Rs bps的情况下，由该服务器注入的比特将顺畅地通过路由器“流动”，并以速率Rs bps到达客户。  
另一方面,如果Rc <Rs，则该路由器将不能像接收速率那样快地转发比特。在这种情况下，比特将以速率Rc离开该路由器，从而得到端到端吞吐量Rc。(还要注意的是，如果比特继续以速率乩到达路由器，继续以乩离开路由器的话，在该路由器中等待传输给客户的积压比特将不断增加，这是一种最不希望的情况！）因此,对于这种简单的两链路网络，其吞吐量是min {Rc,Rs}这就是说，它是瓶颈链路（bottleneck link）的传输速率。

## Why layering?

dealing with complex systems:

*   explicit structure allows identification, relationship of complex system’s pieces  
    layered reference modelfor discussion
*   modularization eases maintenance, updating of system  
    change of implementation of layer’sservice transparent to rest of system  
    e.g., change in gate procedure doesn’t affect rest of system  
    layering considered harmful?

## TCP/IP model (internet model)

TCP服务模型包括面向连接服务和可靠数据传输服务。

*   application:supporting network applications  
    FTP, SMTP, HTTP
*   transport:process-process data transfer  
    TCP, UDP
*   network:routing of datagrams from source to destination  
    IP, routing protocols
*   link:data transfer between neighboring network elements  
    Ethernet, 802.111 (WiFi), PPP
*   physical:bits “on the wire”

## ISO/OSI reference model

ISO = International Standards Office  
OSI = Open Systems Interconnection

*   presentation:allow applications to interpret meaning of data, e.g., encryption, compression, machine-specific conventions
*   session: synchronization, checkpointing, recovery of data exchange
*   Internet stack “missing”these layers!  
    these services, if needed,must be implemented in application

## Layering and headers

Most layers of the TCP/IP model are associated with a particular type of “header” or sometimes a “header and trailer”.  
layer 3 (network) has a “network address” which identifies the host that should receive the data.  
Layer 4 (transport) has a port that identifies which program should receive it.  
At each lower layer a new header is added incorporating the headers underneath. A layer 2 packet has a layer 2 header but includes headers from layer 3 and 4.

## TCP/IP layers

*   Layer 7 –Application layer –this is the data for programs you use on your computer  
    HTTP (www) data, SMTP (sent emails), FTP (file transfer) and specific formats for games, torrent etc.
*   Layer 6 –Presentation layer  
    Related to character sets and presentation of data (unused in TCP/IP or real Internet)
*   Layer 5 –Session layer  
    Related to whole lifetime of connection –is the connection real time (unused in TCP/IP or real Internet)
*   Layer 4 –Transport layer –this is for the end-to-end connection between machines.  
    Information related to reliability  
    Information related to which program on machine sent/receives data.
*   Layer 3 –Network (Internet) layer –this is to get the data the whole journey from its start computer to its end computer (Internet, between networks)  
    Address of computer on internet (IP address)  
    Checksum to see if data is corrupted
*   Layer 2 –Data link layer –this is to get the data to nearby computers (on same local network)  
    Media Access Control (MAC address) specific to individual computer (see later lectures)
*   Layer 1 –Physical layer (how bits 1s and 0s are actually transmitted)  
    Think of cables in the ground or radio waves in the air  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_2.png)

## Devices for layers

*   Router  
    This is a layer 3 device –it reads a layer 3 address and works out which direction a packet should go.  
    It is typically more complex and adaptive than a switch.
*   Switch  
    This is a layer 2 device –it reads a layer 2 address and works out which nearby computer should get a message.  
    Typically simpler than a router.
*   Repeater  
    This is a layer 1 device –it strengthens or reconstructs a corrupted signal and carries on sending it  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_3.png)

# Application Layer

*   This is covered in many other modules you will take.
*   This is the layer you (mostly) work with as a programmer.
*   At the application layer the “network” is abstracted away and you access a stream of data that arrives at a “socket”.
*   It is up to you to define the format of data your application writes and receives.
*   Different applications have different formats:
    *   HTTP (Hyptertexttransfer protocol) world-wide web
    *   FTP (File transfer protocol) moving data
    *   SMTP (Send Mail transfer protocol) sending email
    *   IMAP (Internet message access protocol) receiving email

## Sockets(套接字)

套接字是同一台主机内应用层与运输层之间的接口。由于该套接字是建立网络应用程序的可编程接口，因此套接字也称为应用程序和网络之间的应用程序编程接口（Application Programming Interface, API）进程可类比于一座房子，而它的套接字可以类比于它的门。当一个进程想向 位于另外一台主机上的另一个进程发送报文时，它把报文推出该门（套接字）。该发送进程假定该门到另外一侧之间有运输的基础设施，该设施将把报文传送到目的进程的门口。 一旦该报文抵达目的主机，它通过接收进程的门（套接字）传递，然后接收进程对该报文进行处理。

*   process sends/receives messages to/from its socket
*   socket analogous to door
    1.  sending process shoves message out door
    2.  sending process relies on transport infrastructure on other side of door to deliver message to socket at receiving process

## Addressing processes

在因特网中，主机由其IP地址(IP address)标识。。此时，我们只要知道IP地址是一个32比特的量且它能够唯一地标识该主机就够了。除了知道报文发送目的地的主机地址外，发送进程还必须指定运行在接收主机上的 接收进程(更具体地说，接收套接字)。因为一般而言一台主机能够运行许多网络应用,这些信息是需要的。目的地端口号(port number)用于这个目的。已经给流行的应用分配  
了特定的端口号。

*   to receive messages, process must have identifier
*   host device has unique 32-bit IP address
*   identifierincludes both IP addressand port numbersassociated with process on host.
*   example port numbers:
    *   HTTP server: 80
    *   mail server: 25
*   to send HTTP message to gaia.cs.umass.edu web server:
    *   IP address:128.119.245.12
    *   port number:80

## 4 different addresses in TCP/IP

*   Physical address Layer 2  
    Also known as the link address, is the address of a node as defined by its LAN or WAN
*   Logical address Layer 3 (32-bit , IPv4 128-bit IPv6)  
    Logical (IP) addresses are for universal communications that are independent of underlying physical networks
*   Port address Layer 4 (16-bit)  
    Port addresses differentiate different processes
*   Application-specific address Layer 7  
    Some applications have user-friendly addresses that are designed for that specific application, such as email address, URL.

## App-layer protocol defines

*   types of messages exchanged,  
    e.g. request, response
*   message syntax:  
    what fields in messages & how fields are delineated
*   message semantics  
    meaning of information in fields
*   rules for when and how processes send & respond to messages
*   open protocols:  
    defined in RFCs (request for comments)  
    allows for interoperability  
    e.g., HTTP (web), SMTP (email)
*   proprietary protocols:  
    e.g., Skype

## Session + Presentation layers

*   Theoretical only –not implemented in the Internet
*   Session Layer (layer 5):  
    Takes care of a connection between two hosts for the lifetime of that connection  
    Authentication + authorisation (who is the user, what can they do)  
    In working Internet this is at the application layer.
*   Presentation Layer (layer 6):  
    Translates data for an application.  
    For example takes care of detail of character set used to encode string of characters.  
    In working Internet this is at the application layer

# Transport Layer

## Transport services and protocols

*   provide logical communicationbetween app processes running on different hosts
*   transport protocols run in end systems  
    send side: breaks app messages into segments, passes to network layer  
    rcv side: reassembles segments into messages, passes to app layer
*   more than one transport protocol available to apps  
    Internet: TCP and UDP  
    因特网为应用层提供了两种可用运输层协议:一种是 UDP （用户数据报协议），它为调用它的应用程序提供了一种不可靠unreliable、无连接的服务unordered delivery。另 一种是TCP （传输控制协议），它为调用它的应用程序提供了一种可靠的reliable、面向连接的服务in-order delivery  
    TCP:
*   congestion control
*   flow control
*   connection setup  
    UDP:
*   no-frills extension of “best-effort”IP

## Transport vs. network layer:

network layer:logical communication between hosts  
transport layer:logical communication between processes  
relies on, enhances, network layer services  
应用层报文app messages=信封上的字符  
进程processes=堂兄弟姐妹  
hosts主机（又称为端系统）=家庭  
运输层协议transport protocol=Ann和Bill  
网络层协议network-layer protocol=邮政服务（包括邮车）  
运输层协议只工作在端系统中。在端系统中， 运输层协议将来自应用进程的报文移动到网络边缘（即网络层）

![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_4.png)

## 可靠数据传输协议（reliable data transfer protocol)

![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_5.png)  
调用rdt\_send()函数,上层可以调用数据传输 协议的发送方。它将要发送的数据交付给位于接收方的较高层。(这里rdt表示可靠数据传输协议，\_send指示rdt的发送端正在被调用)在接收端，当分组从信道的接收端到达时，将调用rdt\_rev() 。当rdt协议想要向较 高层交付数据时，将通过调用deliver\_data()来完成。后面，我们将使用术语“分组”而不用运输层的“报文段”。  
consider only unidirectional data transfer,but control info will flow on both directions!只考虑单向数据传输  
use finite state machines (FSM) to specify sender, receiver  
state: when in this “state” next state uniquely determined by next event

## rdt1.0: reliable transfer over a reliable channel

我们考虑最简单的情况，即底层信道是完全可靠的。我们称该协议为rdt1.0  
rdt的发送端只通过rdt\_send(data)事件接受来自较高层的数据，产生一个包含该数据 的分组(经由make-pkt (data)动作)，并将分组发送到信道中。实际上，皿\_send(data)事 件是由较高层应用的过程调用产生的(例如，rdcsend() ) 。  
在接收端，rdt通过rdt\_rcv( packet)事件从底层信道接收一个分组，从分组中取岀数据 (经由extract(packet, data)动作)，并将数据上传给较高层(通过deliver\_data( data)动作)。 实际上，rdt\_rcv( packet)事件是由较低层协议的过程调用产生的(例如，rdt\_rcv() )  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_6.png)

## rdt2.0: channel with bit errors

*   underlying channel may flip bits in packet  
    checksum to detect bit errors
*   thequestion: how to recover from errors:
    *   acknowledgements (ACKs):receiver explicitly tells sender that pkt received OK
    *   negative acknowledgements (NAKs):receiver explicitly tells sender that pkt had errors
    *   sender retransmits pkt on receipt of NAK
*   new mechanisms in rdt2.0(beyond rdt1.0):  
    error detection  
    feedback: control msgs (ACK,NAK) from receiver to sender

![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_7.png)

rdt2.0的发送端有两个状态。在最左边的状态中，发送端协议正等待来自上层传下来  
的数据。当rdt\_send(data)事件岀现时，发送方将产生一个包含待发送数据的分组(sndp-kt),带有检验和，然后经由udt\_send(sndpkt)操作发送该分组。在最右边的状态中，发送方协议等待来自接收方的 ACK或NAK分组。如果收到一个ACK分组，则发送方知道最近发送的分组已被正确接收，因此协议返回到等待来自上层的数据的状态。如果收到一个NAK分组，该协议重传上一个分组并等待接收 方为响应重传分组而回送的ACK和NAK。  
当发送方处于等待ACK或NAK的状态时，它不能从上层获得更多的数据；这就是说，rdcsend()事件不可能岀现；仅当接收到ACK并离开该状态时才能发生这样的事件。因此，发送方将不会发送 一块新数据，除非发送方确信接收方已正确接收当前分组。由于这种行为，rdt2.0这样的协议被称为停等(stop-and-wait)协议。  
stop and wait: sender sends one packet,then waits for receiver response

> what happens if ACK/NAK corrupted?  
> sender doesn’t know what happened at receiver!  
> can’t just retransmit: possible duplicate

> handling duplicates(冗余):  
> sender retransmits current pkt if ACK/NAK corrupted  
> sender adds sequence number(seq) to each pkt  
> receiver discards (doesn’t deliver up) duplicate pkt  
> ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_8.png)  
> ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_9.png)  
> ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_10.png)

## rdt3.0: channels with errors and loss

```
underlying channel can also lose packets (data, ACKs)
```

假定发送方传输一个数据分组，该分组或 者接收方对该分组的ACK发生了丢失。在这两种情况下，发送方都收不到应当到来的接 收方的响应。如果发送方愿意等待足够长的时间以便确定分组已丢失，则它只需重传该数 据分组即可。你应该相信该协议确实有效。  
approach:sender waits “reasonable”amount of time for ACK

*   retransmits if no ACK received in this time
*   if pkt (or ACK) just delayed (not lost):  
    retransmission will be duplicate, but seq. #’s already handles this  
    receiver must specify seq # of pkt being ACKed
*   requires countdown timer  
    为了实现基于时间的重传机制，需要一个倒计数定时器（countdown timer）,在 一个给定的时间量过期后，可中断发送方。因此，发送方需要能做到：①每次发送一个分 组（包括第一次分组和重传分组）时，便启动一个定时器。②响应定时器中断（采取适 当的动作）。③终止定时器。  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_11.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_12.png)

## Summary

*   rdt1.0 assumed no losses or errors
*   rdt2.0 introduced ACK (ACKnowledgment) and NACK to say a packet had been received or an error occurred.
*   rdt2.1 introduced the concept of the SEQuencenumber to deal with errors in ACKs.
*   rdt2.2 introduced the repeated ACK –ACK with repeated sequence number means same as NACK.
*   rdt3.0 introduced timeout in case packet lost completely not just corrupted.

## Pipelined protocols

pipelining:sender allows multiple, “in-flight”, yet-to-be-acknowledged packets (packets with no ACK as yet)

*   range of sequence numbers must be increased
*   buffering at sender and/or receiver
*   two generic forms of pipelined protocols: go-Back-N, selective repeat  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_13.png)  
    utilization利用率  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_14.png)

### Go-back-N:

*   sender can have up to N unacked packets in pipeline
*   receiver only sends cumulative ACK  
    Doesn’t ACK packet if there’s a gap  
    Doesn’t buffer out of order
*   sender has timer for oldest unacked packet  
    when timer expires, retransmit allunacked packets.

在回退N步（GBN）协议中，允许发送方发送多个分组（当有多个分组可用时）而  
不需等待确认，但它也受限于在流水线中未确认的分组数不能超过某个最大允许数N  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_15.png)  
如果我们将基序号（base）定义为最早未确认分组的序号，将下一个序号（nextseqnum）定义为最小的未使用序号（即下 一个待发分组的序号），则可将序号范围分割成4段。在\[0, base-1\]段内的序号对应于已经发送并被确认的分组。\[base, nextseqnum-1 \]段内对应已经发送但未被确认的分  
组。\[nextseqnum, base+N-1\]段内的序号能用于那些要被立即发送的分组，如果有数据来自上层的话。最后，大于或等于base  
+N-1的序号是不能使用的，直到当前流水线中未被确认的分组（特别是序号为base的分组）已得到确认为止。  
N常被称为窗口长度（window size） , GBN协议也常被称为滑动窗口协议 （sliding-window protocol）  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_16.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_15.png)

### Selective Repeat:

*   sender can have up to N packets which it has not seen ACK for in “pipeline”
    
*   Receiver sends individual ACK for each packet
    
*   sender maintains timer for each packet with no ACK  
    when timer expires, retransmit only that unacked packet
    
*   receiver individuallyacknowledges all correctly received packets  
    buffers packets, as needed, for eventual in-order delivery to upper layer
    
*   sender only resends packets for which ACK not received  
    sender timer for each unACKed packet
    
*   sender window  
    Nconsecutive seq #’s  
    limits seq #s of sent, unACKed packets  
    选择重传（SR）协议通过让发送方仅重传那些它怀疑在接收方出错（即丢失或受损）的分组而避免了不必要的重传  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_17.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_18.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_19.png)
    

## 面向连接的运输：TCP

### Introduction

TCP被称为是面向连接的（connection.oriented）,这是因为在一个应用进程可以开始 向另一个应用进程发送数据之前，这两个进程必须先相互“握手”，即它们必须相互发送  
某些预备报文段，以建立确保数据传输的参数。

*   point-to-point:one sender, one receiver单个发送 方与单个接收方之间的连接
    
*   reliable, in-order byte steam:no “message boundaries”
    
*   pipelined(流水线):TCP congestion and flow control set window size
    
*   full duplex data:
    
    bi-directional data flow in same connection
    
    MSS: maximum segment size。
    

TCP可从缓存中取出并放入报文段中的数据数量受限于最大报文段长度（Maximum Segment Size,MSS）。 MSS通常根据最初确定的由本地发送主机发送的最大链路层帧长度（即所谓的最大传输单元（Maximum Transmission Unit, MTU））来设置。

*   connection-oriented:handshaking (exchange of control msgs) inits sender, receiver state before data exchange
*   flow controlled:sender will not overwhelm receiver  
    客户首先发送一个特殊的TCP报文段，服务器用 另一个特殊的TCP报文段来响应，最后，客户再用第三个特殊报文段作为响应。前两个报 文段不承载“有效载荷”，也就是不包含应用层数据；而第三个报文段可以承载有效载荷。 由于在这两台主机之间发送了 3个报文段，所以这种连接建立过程常被称为三次握手（three- way handshake）  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_20.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_21.png)

### TCP round trip time, timeout

报文段的样本RTT （表示为SampleRTT）就 是从某报文段被发出（即交给IP）到对该报文段的确认被收到之间的时间量。  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_22.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_23.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_24.png)

### TCP sender events

在TCP发送方有3个与发送和重传有关的主要事件：从上层应用程序接收数据；定时器超时和收到ACK。  
第一个主要事件TCP从应用程序接收数据，将数据封装在一个报文段中，并把该报文段交给IP。注意到每一个报文段都包含一个序号，这个序号就是该报文段第一个数据字节的字节流编号。如果定时器还没有为某些其他报文段而运行，则当报文段被传给IP时，TCP就启动该定时器。该定时器的过期间隔是Timeoutinterval,由EstimatedRTT和DevRTT计算得出。  
第二个主要事件是超时。TCP通过重传引起超时的报文段来响应超时事件。然后TCP重启定时器。  
第三个主要事件是，到达一个来自接收方的确认报文段（ACK）（更确切地说，是一个包含了有效ACK字段值的报文段）。当该事件发生时，TCP将ACK的值y与它的变量SendBase进行比较。  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_25.png)

## TCP flow control

```
receiver controls sender, so sender will not overflow receiver buffer(缓冲区) by transmitting too much, too fast
```

![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_26.png)

## MSS and MTU

*   MSS 最大报文段长度(mentioned in Nagle algorithm) is a parameter specifying the largest amount of data in a single IP datagram that should be sent by a remote host.
*   MTU最大链路层帧长度 is a parameter specifying the largest amount of data that a communication protocol or system can pass onwards. For example, standards (e.g. Ethernet) can fix the size of an MTU, or systems (such as point-to-point serial links) may set MTU at connect time.
*   MSS size is set according to MTU:  
    MSS = MTU –IP header size –TCP header size.

## Nagle’s algorithm

Nagle算法的主要目的是为了预防小分组的产生，因为在广域网中，小分组会造成网络拥塞。  
A problem can occur when an application generates data very slowly.  
Consider, ssh that generates data only when a user types.  
TCP will send the data as it arrives at the send buffer if there is space left in the send buffer.  
This means (for ssh) one packet sent every time user hits key.  
Overhead of this is huge (TCP header + IP header + frame header to send one byte).  
Cure is known as “Nagle’s algorithm”.

1.  The sending TCP sends the first piece of data it receives –no matter no small or large
2.  Sending TCP accumulates data in the buffer and waits until one of the following before sending the segment:  
    The receiving TCP sends an acknowledgement  
    Data has accumulated to fill a maximum size segment
3.  Repeat step 2

## Silly Window Syndrome

Silly Window Syndrome occurs when the TCP system is forced to send very small packets. Named because window size is “silly”.  
This can happen in two separate ways:

1.  Sender produces data very slowly.  
    Same problem as Nagle’s algorithm.
2.  Receiver processes data very slowly.  
    •Single byte or small number removed from full receive buffer.  
    •Sender is informed of opportunity to send small number of bytes and immediately sends filling buffer.  
    •Process repeats.  
    •Cure –receiver does not advertise windows that would cause sender to send small amounts of data.

## Connection Management

before exchanging data, sender/receiver “handshake”:

*   agree to establish connection (each knowing the other willing to establish connection)
*   agree on connection parameters  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_27.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_28.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_29.png)

## TCP: closing a connection

*   client, server each close their side of connection  
    send TCP segment with FIN bit = 1
*   respond to received FIN with ACK  
    on receiving FIN, ACK can be combined with own FIN
*   simultaneous FIN exchanges can be handled  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_30.png)

## Principles of congestion control

congestion:

*   informally: “too many sources sending too much data too fast for networkto handle”
*   different from flow control!  
    how does this look?  
    •lost packets (buffer overflow at routers)  
    •long delays (queueing in router buffers)
*   a top-10 problem!

## Causes and costs of congestion

*   Too much traffic enters router –buffer fills up, this increases delay (and hence reduces throughput).
*   Much too much traffic enters router –buffer overfills and causes loss. Packet needs to be retransmitted.
*   If packet is lost after several “hops” then many resources are wasted. (e.g. Packet travels from A to B to C to D then lost at D –it has taken up space at A, B and C unnecessarily).
*   Useful concept: goodput–this is the rate at which data reaches the application layer. Different from throughput because of:  
    •loss  
    •retransmission  
    •corrupted packets  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_31.png)  
    ![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_32.png)

# Network layer

## Two key network-layer functions

### network-layer functions:

*   forwarding: move packets from router’s input to appropriate router output
*   routing: determine route taken by packets from source to destination  
    routing algorithms

### analogy: taking a trip

*   forwarding: process of getting through one road junction
*   routing: process of planning trip from source to destination  
    转发(forwarding)是指将分组从一个输入链路接口转移到 适当的输出链路接口的路由器本地动作。转发发生的时间尺度很短(通常为几纳秒)，因 此通常用硬件来实现。  
    路由选择(routing)是指确定分组从源到目的地所采取的端到端路 径的网络范围处理过程。

## Network Layer

*   transport segment from sending to receiving host
*   on sending side encapsulates segments into datagrams
*   on receiving side, delivers segments to transport layer
*   network layer protocols in every host, router
*   router examines header fields in all IP datagrams passing through it

### IPv4 address notation

There are three common notations to show an IPv4 address:  
• binary notation  
• dotted-decimal notation (most commonly used)  
• hexadecimal notation

### data plane

local, per-router function  
determines how datagram arriving on router input port is forwarded to router output port  
forwarding function

### Control plane

network-wide logic  
determines how datagram is routed among routers along end-end path from source host to destination host  
two control-plane approaches:  
traditional routing algorithms: implemented in routers  
software-defined networking (SDN): implemented in (remote) servers  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_33.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_34.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_35.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_36.png)  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_37.png)

### Longest prefix matching

![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_38.png)  
we’ll see why longest prefix matching is used shortly, when we study addressing  
longest prefix matching: often performed using ternary content addressable memories (TCAMs) specialised very high speed memory  
content addressable: present address to TCAM: retrieve address in one clock cycle, regardless of table size  
Cisco Catalyst: can up ~1M routing table entries in TCAM  
![alt text](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_39.png)

## Summary

*   Network layer moves data from “source” all the way to the “destination”.
*   Control plane makes decisions about routes taken by packets it spans a network.
*   Data plane implements the decisions and gets the data from place to place. It is local to a router.
*   Longest prefix matching on a router is used to pick where to send data.
*   Fragmentation and reassembly can be used to split and rejoin IP packets.

## IP addressing

### Introduction

*   IP address:32-bit identifier for host, router interface
*   interface:connection between host/router and physical link
    *   routers typically have multiple interfaces
    *   host typically has one or two interfaces (e.g., wired Ethernet, wireless 802.11)
*   IP addresses associated with each interface  
    ![网络接口与 IP 地址示意图](/img/%E5%A4%A7%E4%BA%8C%E4%B8%8BEBU5213%20Internet%20protocols%20and%20networks_image_40.png)
